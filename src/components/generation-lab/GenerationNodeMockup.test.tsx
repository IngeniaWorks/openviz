import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { GenerationNodeMockup } from './GenerationNodeMockup';
import { MODIFY_PROMPT_TEMPLATES } from './GenerationModifyMode';

/**
 * The mockup submits through the real render-task surface. In tests no image
 * backend is configured, so image-workflow submissions fail at the capability
 * check and video submissions (ComfyUI fallback) at the FR-021 benchmark gate —
 * both before any network or persistence, proving the wiring without side effects.
 */
const NO_BACKEND_ERROR = /no image backend is configured/i;
const GATE_ERROR = /benchmark gate/i;

beforeEach(() => {
    useStore.setState({
        renderReferences: [], renderTaskStatus: 'idle', renderTaskQueuePosition: null, renderTaskError: null,
        renderTaskOutputs: [], renderTaskExtraction: null, renderTaskId: null, renderRecordId: null, lastRenderRequest: null,
    });
});

describe('GenerationNodeMockup', () => {
    it('uses the Workbench node shell and shows the specified base actions', () => {
        render(<GenerationNodeMockup />);

        const node = screen.getByRole('region', { name: 'Shared generation node' });
        expect(node).toHaveClass('w-[280px]', 'bg-viz-panel', 'border-viz-accent', 'ring-viz-accent');
        const fieldButton = screen.getByRole('button', { name: 'Describe your changes' });
        expect(fieldButton).toBeEnabled();
        expect(fieldButton).toHaveClass('rounded-lg', 'px-2', 'bg-viz-selected', 'text-white');
        expect(screen.getByRole('button', { name: 'Instant Render' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Change expression' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Variate form and color' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'New view' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Extract' })).toBeEnabled();
    });

    it('opens the Modify node from the prompt field button, keeps its label after going back, and still lets other actions transition', async () => {
        render(<GenerationNodeMockup />);

        fireEvent.click(screen.getByRole('button', { name: 'Describe your changes' }));
        expect(await screen.findByRole('button', { name: /Aspect ratio 1:1/ })).toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText('Describe your changes'), { target: { value: 'Brushed aluminum housing' } });
        fireEvent.click(screen.getByRole('button', { name: 'Back to actions' }));

        const fieldButton = await screen.findByRole('button', { name: 'Describe your changes' });
        expect(fieldButton).toHaveTextContent('Describe your changes');

        fireEvent.click(fieldButton);
        expect(await screen.findByPlaceholderText('Describe your changes')).toHaveValue('Brushed aluminum housing');

        fireEvent.click(screen.getByRole('button', { name: 'Back to actions' }));
        fireEvent.click(await screen.findByRole('button', { name: 'New view' }));
        expect(await screen.findByRole('heading', { name: 'New view' })).toBeInTheDocument();
    });

    it('morphs into the Modify edit panel as soon as the prompt field button is clicked, keeping focus on the prompt', async () => {
        render(<GenerationNodeMockup />);

        fireEvent.click(screen.getByRole('button', { name: 'Describe your changes' }));

        await screen.findByRole('button', { name: /Aspect ratio 1:1/ });
        const prompt = screen.getByPlaceholderText('Describe your changes');
        expect(prompt).toHaveFocus();
        expect(within(screen.getByLabelText('Prompt editor')).getByText('Arc Lamp')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled();
    });

    it('numbers the reference chip and resolves @ mentions in the prompt to the numbered token', async () => {
        render(<GenerationNodeMockup />);
        fireEvent.click(screen.getByRole('button', { name: 'Modify' }));
        await screen.findByRole('button', { name: /Aspect ratio 1:1/ });

        const chip = within(screen.getByLabelText('Prompt editor')).getByLabelText('Reference image 1');
        const badge = within(chip).getByText('1');
        expect(badge).toHaveClass('-top-1', '-right-1');
        expect(chip).toHaveTextContent('Arc Lamp');

        const prompt = screen.getByPlaceholderText('Describe your changes') as HTMLTextAreaElement;
        expect(screen.queryByRole('listbox', { name: 'Reference suggestions' })).not.toBeInTheDocument();

        fireEvent.change(prompt, { target: { value: 'Use @' } });
        prompt.focus();
        const option = await screen.findByRole('option', { name: /Arc Lamp/ });
        fireEvent.mouseDown(option);
        expect(prompt).toHaveFocus();
        fireEvent.click(option);

        expect(prompt).toHaveValue('Use @1 ');
        await waitFor(() => expect(prompt).toHaveFocus());
        expect(prompt.selectionStart).toBe(prompt.value.length);
        expect(screen.queryByRole('listbox', { name: 'Reference suggestions' })).not.toBeInTheDocument();
    });

    it('renders inserted references as blue blocks in the prompt and removes the whole token on backspace', async () => {
        render(<GenerationNodeMockup />);
        fireEvent.click(screen.getByRole('button', { name: 'Modify' }));
        await screen.findByRole('button', { name: /Aspect ratio 1:1/ });

        const prompt = screen.getByPlaceholderText('Describe your changes') as HTMLTextAreaElement;
        fireEvent.change(prompt, { target: { value: 'Use @' } });
        fireEvent.click(await screen.findByRole('option', { name: /Arc Lamp/ }));
        expect(prompt).toHaveValue('Use @1 ');

        const block = screen.getByText('@1');
        expect(block).toHaveClass('rounded-full', 'bg-viz-accent', 'font-bold', 'text-white');

        prompt.selectionStart = 6;
        prompt.selectionEnd = 6;
        fireEvent.keyDown(prompt, { key: 'Backspace' });

        await waitFor(() => expect(prompt).toHaveValue('Use '));
        expect(screen.queryByText('@1')).not.toBeInTheDocument();
        await waitFor(() => expect(prompt.selectionStart).toBe(3));
    });

    it('shows Make/Change/Insert template chips that append a sentence starter and place the cursor at the end', async () => {
        render(<GenerationNodeMockup />);
        fireEvent.click(screen.getByRole('button', { name: 'Modify' }));
        await screen.findByRole('button', { name: /Aspect ratio 1:1/ });

        expect(within(screen.getByLabelText('Prompt templates')).getAllByRole('button').map((chip) => chip.textContent?.trim()))
            .toEqual(MODIFY_PROMPT_TEMPLATES.map((template) => `${template.trim()}…`));

        const prompt = screen.getByPlaceholderText('Describe your changes') as HTMLTextAreaElement;
        fireEvent.change(prompt, { target: { value: 'the housing metallic' } });
        fireEvent.click(screen.getByRole('button', { name: 'Change…' }));

        expect(prompt).toHaveValue('the housing metallic Change ');
        await waitFor(() => expect(prompt).toHaveFocus());
        expect(prompt.selectionStart).toBe(prompt.value.length);
    });

    it('lists Modify and Animate actions with Animate below Modify, preserving the spec\'d base preset list', () => {
        render(<GenerationNodeMockup />);

        const actions = screen.getByLabelText('Generation actions');
        const labels = within(actions).getAllByRole('button').map((button) => button.getAttribute('aria-label'));
        expect(labels).toEqual(['Modify', 'Animate', 'Instant Render', 'Variate form and color', 'New view', 'Change expression', 'Extract']);
    });

    it('keeps the aspect ratio dropdown hidden until clicked, updates the chip, and survives a round trip to base', async () => {
        render(<GenerationNodeMockup />);
        fireEvent.click(screen.getByRole('button', { name: 'Modify' }));

        await screen.findByRole('button', { name: /Aspect ratio 1:1/ });
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Aspect ratio 1:1/ }));
        fireEvent.click(await screen.findByRole('option', { name: '3:4' }));
        expect(screen.getByRole('button', { name: /Aspect ratio 3:4/ })).toBeInTheDocument();
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Back to actions' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Modify' }));

        expect(await screen.findByRole('button', { name: /Aspect ratio 3:4/ })).toBeInTheDocument();
    });

    it('enables Generate once the modify prompt has text and submits the mock action', async () => {
        render(<GenerationNodeMockup />);
        fireEvent.click(screen.getByRole('button', { name: 'Modify' }));

        await screen.findByRole('button', { name: /Aspect ratio 1:1/ });
        const generate = screen.getByRole('button', { name: 'Generate' });
        expect(generate).toBeDisabled();

        fireEvent.change(screen.getByPlaceholderText('Describe your changes'), { target: { value: 'Brushed aluminum housing' } });
        expect(generate).toBeEnabled();
        fireEvent.click(generate);

        // Real wiring: the submission reaches the render-task surface and fails at the capability check (no backend in tests).
        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(NO_BACKEND_ERROR));
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('opens the Animate mode with its frames and settings body', async () => {
        render(<GenerationNodeMockup />);
        fireEvent.click(screen.getByRole('button', { name: 'Animate' }));

        expect(await screen.findByRole('heading', { name: 'Animate' })).toBeInTheDocument();
        expect(screen.getByText('Start')).toBeInTheDocument();
        expect(screen.getByText('End · optional')).toBeInTheDocument();

        // A motion description is required before the real submit is enabled.
        expect(screen.getByRole('button', { name: /^Animate$/i })).toBeDisabled();
        fireEvent.change(screen.getByPlaceholderText(/describe the motion/i), { target: { value: 'slow 360 turntable' } });

        fireEvent.change(screen.getByLabelText('Style'), { target: { value: 'cinematic' } });
        fireEvent.change(screen.getByLabelText('Duration'), { target: { value: '8s' } });
        fireEvent.click(screen.getByRole('button', { name: /^Animate$/i }));

        // Video passes the capability check via the ComfyUI fallback, then stops at the FR-021 benchmark gate.
        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(GATE_ERROR));
    });

    it('opens the minimal Instant Render form with its connected reference and animated generate action', async () => {
        render(<GenerationNodeMockup />);
        fireEvent.click(screen.getByRole('button', { name: 'Instant Render' }));

        expect(await screen.findByRole('heading', { name: 'Instant Render' })).toBeInTheDocument();
        // The connected reference name is displayed from the render-task references.
        expect(screen.getByText('Arc Lamp')).toBeInTheDocument();
        const prompt = screen.getByPlaceholderText('Describe your changes');
        expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled();
        fireEvent.change(prompt, { target: { value: 'Warm brushed aluminum' } });
        const generate = screen.getByRole('button', { name: 'Generate' });
        expect(generate).toBeEnabled();
        // FR-013: the seven aspect-ratio presets are offered.
        expect(screen.getByRole('combobox', { name: /aspect ratio/i })).toBeInTheDocument();
        fireEvent.click(generate);

        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(NO_BACKEND_ERROR));
    });

    it('preserves Variation form settings across base-state transitions', async () => {
        render(<GenerationNodeMockup />);
        fireEvent.click(screen.getByRole('button', { name: 'Variate form and color' }));

        expect(await screen.findByRole('heading', { name: 'Variation' })).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('top axis label'), { target: { value: 'Soft' } });
        fireEvent.change(screen.getByLabelText('Preset'), { target: { value: 'Organic' } });
        fireEvent.keyDown(screen.getByRole('slider', { name: 'Variation position' }), { key: 'ArrowRight' });
        expect(screen.getByText('Position: right')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Back to actions' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Variate form and color' }));

        expect(await screen.findByLabelText('top axis label')).toHaveValue('Soft');
        expect(screen.getByLabelText('Preset')).toHaveValue('Organic');
        expect(screen.getByRole('slider', { name: 'Variation position' })).toHaveAttribute('aria-valuetext', 'right');
        fireEvent.click(screen.getByRole('button', { name: 'Reset to center' }));
        expect(screen.getByRole('slider', { name: 'Variation position' })).toHaveAttribute('aria-valuetext', 'center');
    });

    it('preserves Variation color palette changes when switching to and from the base state', async () => {
        render(<GenerationNodeMockup />);
        fireEvent.click(screen.getByRole('button', { name: 'Variate form and color' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Color' }));
        fireEvent.change(screen.getByLabelText('Palette name'), { target: { value: 'Night garden' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add swatch' }));
        fireEvent.change(screen.getByLabelText('Colorways'), { target: { value: '8' } });
        fireEvent.click(screen.getByRole('button', { name: 'Back to actions' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Variate form and color' }));

        expect(await screen.findByRole('button', { name: 'Color' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByLabelText('Palette name')).toHaveValue('Night garden');
        expect(screen.getByLabelText('Colorways')).toHaveValue('8');
        expect(within(screen.getByRole('group', { name: 'Palette swatches' })).getAllByRole('img')).toHaveLength(5);
    });

    it('requires a selected view before allowing New view generation', async () => {
        render(<GenerationNodeMockup />);
        fireEvent.click(screen.getByRole('button', { name: 'New view' }));

        expect(await screen.findByRole('heading', { name: 'New view' })).toBeInTheDocument();
        expect(screen.getByText('1 ref')).toBeInTheDocument();
        const generate = screen.getByRole('button', { name: 'Generate' });
        expect(generate).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Select a view' }));
        fireEvent.click(screen.getByRole('option', { name: 'Rear Right 3/4 view' }));
        expect(generate).toBeEnabled();

        fireEvent.click(generate);
        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(NO_BACKEND_ERROR));
    });

    it('runs Extract against the connected reference with type and sampling controls', async () => {
        render(<GenerationNodeMockup />);
        fireEvent.click(screen.getByRole('button', { name: 'Extract' }));

        expect(await screen.findByRole('heading', { name: 'Extract' })).toBeInTheDocument();
        // The demo reference is connected, so extraction is immediately runnable.
        expect(screen.getByRole('button', { name: 'Update colors' })).toBeEnabled();
        fireEvent.click(screen.getByRole('button', { name: 'Material' }));
        const action = screen.getByRole('button', { name: 'Extract material' });
        expect(action).toBeEnabled();
        fireEvent.change(screen.getByLabelText(/sample by/i), { target: { value: 'Region' } });
        fireEvent.click(action);

        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(NO_BACKEND_ERROR));
    });

    it('reveals a plain-language mode description from the info control', async () => {
        render(<GenerationNodeMockup />);
        fireEvent.click(screen.getByRole('button', { name: 'Extract' }));
        await screen.findByRole('heading', { name: 'Extract' });
        fireEvent.click(screen.getByRole('button', { name: 'About Extract' }));

        expect(screen.getByRole('tooltip')).toHaveTextContent('Sample color, material, or parts from a reference image.');
    });
});
