import { auth } from "@/lib/auth";
import { db } from "@/lib/auth";
import { projects, workspaces, workspaceMemberships } from "@/lib/db/schema";
import { ensureUserBootstrap } from "@/lib/services/bootstrap";
import { ProjectSchema } from "@/lib/schemas/base";
import { downsampleDataUrls, DATA_URL_DOWNSAMPLE_THRESHOLD } from "@/lib/services/thumbnail";
import { eq, and, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * Mock-mode project rows can carry full-resolution base64 thumbnails in
 * `thumbnailUrl` (S3 mode stores short refs). Downscale them before the list
 * response so the dashboard doesn't ship multi-MB payloads (LCP decode-bound).
 */
async function downsampleProjectThumbnails<T extends { thumbnailUrl: string | null }>(rows: T[]): Promise<void> {
    const targets = rows.filter(
        (row): row is T & { thumbnailUrl: string } =>
            typeof row.thumbnailUrl === "string" &&
            row.thumbnailUrl.startsWith("data:image") &&
            row.thumbnailUrl.length > DATA_URL_DOWNSAMPLE_THRESHOLD
    );
    if (targets.length === 0) return;
    const wrappers = targets.map((row) => ({ row, value: row.thumbnailUrl }));
    await downsampleDataUrls(wrappers);
    for (const { row, value } of wrappers) row.thumbnailUrl = value;
}

/**
 * GET /api/projects
 * Fetches all projects for the authenticated user in a specific workspace.
 * Ensures bootstrap data exists and then fetches projects.
 */
export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");

    const userId = session.user.id;
    await ensureUserBootstrap(db, {
        userId,
        email: session.user.email ?? null,
        name: session.user.name ?? null,
        image: session.user.image ?? null,
    });

    const userMemberships = await db
        .select()
        .from(workspaceMemberships)
        .where(eq(workspaceMemberships.userId, userId));

    if (!workspaceId) {
        const userProjects = await db
            .select()
            .from(projects)
            .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
            .innerJoin(workspaceMemberships, eq(workspaces.id, workspaceMemberships.workspaceId))
            .where(eq(workspaceMemberships.userId, userId))
            .orderBy(desc(projects.lastViewedAt));

        const allProjects = userProjects.map(p => p.projects);
        await downsampleProjectThumbnails(allProjects);

        return NextResponse.json(allProjects, {
            headers: { "Cache-Control": "private, max-age=5, stale-while-revalidate=60" },
        });
    }

    // Verify membership in the requested workspace
    const isMember = userMemberships.some(m => m.workspaceId === workspaceId);
    if (!isMember) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const workspaceProjects = await db
        .select()
        .from(projects)
        .where(eq(projects.workspaceId, workspaceId))
        .orderBy(desc(projects.lastViewedAt));

    await downsampleProjectThumbnails(workspaceProjects);

    return NextResponse.json(workspaceProjects, {
        headers: { "Cache-Control": "private, max-age=5, stale-while-revalidate=60" },
    });
}

/**
 * POST /api/projects
 * Creates a new project in a workspace.
 */
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    await ensureUserBootstrap(db, {
        userId: session.user.id,
        email: session.user.email ?? null,
        name: session.user.name ?? null,
        image: session.user.image ?? null,
    });

    // If workspaceId is missing, try to find one for the user
    if (!body.workspaceId) {
        const memberships = await db
            .select()
            .from(workspaceMemberships)
            .where(eq(workspaceMemberships.userId, session.user.id))
            .limit(1);

        if (memberships.length > 0) {
            body.workspaceId = memberships[0].workspaceId;
        } else {
            return NextResponse.json({ error: "No workspace found. Please refresh the dashboard." }, { status: 400 });
        }
    }

    const validated = ProjectSchema.omit({
        id: true,
        createdAt: true,
        updatedAt: true,
        lastViewedAt: true,
    }).safeParse(body);

    if (!validated.success) {
        return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    // Verify membership in the workspace
    const membership = await db
        .select()
        .from(workspaceMemberships)
        .where(
            and(
                eq(workspaceMemberships.workspaceId, validated.data.workspaceId),
                eq(workspaceMemberships.userId, session.user.id)
            )
        );

    if (membership.length === 0) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [newProject] = await db.insert(projects).values({
        ...validated.data,
        workspaceId: validated.data.workspaceId,
    }).returning();

    return NextResponse.json(newProject);
}
