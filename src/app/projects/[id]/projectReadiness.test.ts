import { describe, expect, it } from "vitest";
import { shouldHydrateFromServer, shouldPaintFromCache } from "./projectReadiness";

describe("shouldPaintFromCache", () => {
    const base = {
        lastOpenedProjectId: "p-1",
        persistHydrated: true,
        workbenchNodeCount: 3,
        collabSessionActive: false,
    };

    it("paints when the persisted store holds nodes for this project", () => {
        expect(shouldPaintFromCache(base, "p-1")).toBe(true);
    });

    it("waits for IndexedDB rehydration to finish", () => {
        expect(shouldPaintFromCache({ ...base, persistHydrated: false }, "p-1")).toBe(false);
    });

    it("never paints from cache while a collab session owns the scene", () => {
        expect(shouldPaintFromCache({ ...base, collabSessionActive: true }, "p-1")).toBe(false);
    });

    it("does not paint when the persisted nodes belong to another project", () => {
        expect(shouldPaintFromCache({ ...base, lastOpenedProjectId: "p-2" }, "p-1")).toBe(false);
    });

    it("does not paint an empty cache", () => {
        expect(shouldPaintFromCache({ ...base, workbenchNodeCount: 0 }, "p-1")).toBe(false);
    });
});

describe("shouldHydrateFromServer", () => {
    it("never hydrates while collab owns the scene", () => {
        expect(
            shouldHydrateFromServer({ paintedFromCache: false, collabOwnsScene: true, localVersion: 1, serverVersion: 2 })
        ).toBe(false);
    });

    it("always hydrates on a fresh load (no cache paint)", () => {
        expect(
            shouldHydrateFromServer({ paintedFromCache: false, collabOwnsScene: false, localVersion: 99, serverVersion: 1 })
        ).toBe(true);
    });

    it("keeps local state when the local version is strictly newer", () => {
        expect(
            shouldHydrateFromServer({ paintedFromCache: true, collabOwnsScene: false, localVersion: 8, serverVersion: 7 })
        ).toBe(false);
    });

    it("hydrates when the server version equals or exceeds local", () => {
        expect(
            shouldHydrateFromServer({ paintedFromCache: true, collabOwnsScene: false, localVersion: 7, serverVersion: 7 })
        ).toBe(true);
        expect(
            shouldHydrateFromServer({ paintedFromCache: true, collabOwnsScene: false, localVersion: 7, serverVersion: 9 })
        ).toBe(true);
    });

    it("hydrates when either version is unknown", () => {
        expect(
            shouldHydrateFromServer({ paintedFromCache: true, collabOwnsScene: false, localVersion: null, serverVersion: 3 })
        ).toBe(true);
        expect(
            shouldHydrateFromServer({ paintedFromCache: true, collabOwnsScene: false, localVersion: 3, serverVersion: null })
        ).toBe(true);
    });
});
