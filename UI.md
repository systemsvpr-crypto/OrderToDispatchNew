UI Specification for Management Systems
This document defines the industry-standard UI guidelines for building professional, responsive management systems, using the DispatchPlanning component as a reference. It is intended for AI agents and development teams to ensure a consistent, accessible, and error‑free user interface that adapts flawlessly to any device screen size.

1. Design Principles
Clarity – Every element serves a clear purpose. Use visual hierarchy (headings, spacing, borders) to guide users.

Efficiency – Minimize clicks with bulk actions, searchable dropdowns, and persistent filters. Provide immediate feedback (toasts, loading states).

Consistency – Reuse components (buttons, tables, cards) across the entire application. Maintain uniform spacing, typography, and colors.

Accessibility – Comply with WCAG 2.1 AA: sufficient contrast, keyboard navigable, focus indicators, and semantic HTML.

Responsiveness – Use fluid grids, flexible components, and breakpoints to deliver a seamless experience from mobile to desktop. No horizontal scroll on any viewport.

2. Color Palette
All colors are defined as Tailwind CSS classes in the reference component. For a consistent look, use the following semantic color roles:

Role	Light Theme (Tailwind Classes)	Dark Theme (optional)
Primary	bg-primary text-primary (#58cc02)	bg-primary-dark
Secondary	bg-gray-100	bg-gray-800
Background	bg-white or bg-gray-50 (page)	bg-gray-900
Surface	bg-white (cards, tables)	bg-gray-800
Text Primary	text-gray-900	text-gray-100
Text Secondary	text-gray-500 or text-gray-600	text-gray-400
Border	border-gray-200 or border-gray-100	border-gray-700
Success	text-green-600 (or bg-green-50)	text-green-400
Danger	text-red-600	text-red-400
Warning	text-yellow-600	text-yellow-400
Implementation: Use Tailwind CSS utility classes directly. For custom CSS, define CSS custom properties (variables) to enable theming.

3. Typography
3.1 Font Family
Use the system font stack for optimal performance and native feel:

css
font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
3.2 Font Sizes & Weights
Reference component uses Tailwind’s typography scale. Follow this consistent set:

Element	Tailwind Class	Size (rem)	Weight	Use Case
Page Title	text-xl	1.25rem	font-bold	Main heading (h1)
Section Header	text-lg	1.125rem	font-semibold	Card titles, filter labels
Table Header	text-xs	0.75rem	font-bold uppercase	Column titles
Body Text	text-sm	0.875rem	normal	Regular content, table cells
Small Text	text-[10px] or text-xs	0.75rem	font-medium	Labels, metadata, badges
Button Text	text-xs or text-sm	0.75–0.875rem	font-bold	Buttons, actions
Responsive Typography: Use clamp() for fluid headings (e.g., h1 { font-size: clamp(1.5rem, 5vw, 2rem); }). For body text, prefer text-sm on mobile, text-base on larger screens.

3.3 Line Height
Body: leading-normal (1.5)

Headings: leading-tight (1.25)

Table cells: leading-normal or leading-relaxed

4. Layout Structure
4.1 Page Container
Wrap content in a div with responsive padding:

html
<div class="p-3 sm:p-6 lg:p-8 max-w-[1200px] mx-auto">
p-3 on mobile, sm:p-6 on tablets, lg:p-8 on desktops.

Center content with mx-auto and limit width to 1200px for readability.

4.2 Header Section (Filter Bar)
The reference component uses a two‑row header:

Row 1: Title, tabs, and action buttons (Refresh, Clear Filters, Cancel/Save).

Row 2: Filter inputs (search, dropdowns) arranged in a responsive grid.

html
<div class="flex flex-col gap-4 mb-6 bg-white p-4 lg:p-5 rounded shadow-sm border border-white/50">
  <!-- Top row -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div class="flex flex-wrap items-center gap-4">...</div>
    <div class="flex flex-wrap items-center gap-2">...</div>
  </div>
  <!-- Filter grid -->
  <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
    ...
  </div>
</div>
4.3 Main Content Area
Use a white card (bg-white rounded shadow) for data tables. On mobile, switch to card layout.

5. Component Styles
5.1 Buttons
Variants:

Primary – bg-primary text-white rounded hover:bg-primary-hover shadow-md font-bold text-xs px-3 py-2

Secondary – bg-gray-100 text-gray-700 rounded hover:bg-gray-200 border border-gray-200

Outline – bg-white border border-gray-200 text-gray-700 hover:bg-gray-50

Icon Button – flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded

States:

Disabled: opacity-50 cursor-not-allowed

Loading: show spinner inside button

5.2 Inputs & Selects
Text Input / Search:

html
<input type="text" class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded focus:ring-primary focus:border-primary" />
Select / Dropdown (native):

html
<select class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded focus:ring-primary focus:border-primary">
  ...
</select>
Searchable Dropdown (custom):
The component uses a custom SearchableDropdown that mimics a select with search. Its styling should match the standard input.

Checkbox:

html
<input type="checkbox" class="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer" />
5.3 Data Table (Desktop)
html
<div class="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 max-h-[460px] overflow-y-auto">
  <table class="w-full text-left border-collapse min-w-[1200px]">
    <thead class="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
      <tr class="text-xs uppercase text-gray-600 font-bold">
        <th class="px-6 py-4">...</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-gray-200 text-sm">
      <tr class="hover:bg-gray-50 transition-colors">...</tr>
    </tbody>
  </table>
</div>
Sticky header with sticky top-0 z-10 shadow-sm.

Horizontal scroll on small screens (overflow-x-auto).

Min‑width for table to prevent column squashing.

5.4 Card View (Mobile)
When screen width < 768px, tables become cards:

html
<div class="md:hidden divide-y divide-gray-200">
  <div class="p-4 space-y-4 bg-white">
    <div class="flex justify-between items-start">...</div>
    <div class="grid grid-cols-2 gap-3">...</div>
  </div>
</div>
Cards use divide-y for separation.

Each card contains key fields with labels, mimicking a table row.

5.5 Loading Overlay
The component uses a full‑screen semi‑transparent overlay with a centered animated spinner:

html
<div class="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/40 backdrop-blur-md">
  <div class="bg-white/80 p-10 rounded-3xl shadow-lg flex flex-col items-center gap-6">
    <svg class="w-16 h-16 animate-spin">...</svg>
    <h3 class="text-lg font-black text-gray-800 uppercase tracking-wider">Loading...</h3>
  </div>
</div>
5.6 Toast Notifications
Use a context provider (useToast) to display success/error messages. Style toast with a fixed position, background, and auto‑dismiss.

6. Responsive Breakpoints
Breakpoint	Tailwind Prefix	Behavior
< 640px	max-sm:	Stack layout, full‑width cards, filters in 2 columns
640px–767px	sm:	Filters in 2–3 columns, header row wraps
768px–1023px	md:	Tablet: filters in 3–4 columns, table visible but may collapse? The component hides table and shows cards on md:hidden. Actually in the component, table is hidden on md:hidden (i.e., hidden on screens < 768px) and cards appear. Table is visible on md:block. This is reversed: the component uses hidden md:block for table, meaning table is hidden on small screens, block on ≥768px. That’s correct.
≥ 1024px	lg:	Desktop layout: expanded padding, filters in 4–7 columns, table with full columns.
Implementation: Use Tailwind’s responsive utilities (sm:, md:, lg:, xl:) to conditionally apply styles.

7. Accessibility
Focus Management: All interactive elements must have a visible focus ring (focus:ring-primary focus:border-primary). Use outline: none only after adding custom focus styles.

Keyboard Navigation: Ensure all actions can be performed using Tab, Enter, Space, and arrow keys.

ARIA: Use aria-label for icon‑only buttons, aria-expanded for collapsible elements, and aria-current="page" for active navigation.

Semantic HTML: Use <header>, <main>, <section>, <table>, <th>, etc., appropriately.

Contrast: All text must meet WCAG AA contrast ratio (4.5:1 for normal text). Tailwind’s default gray palette is accessible.

8. State Handling
8.1 Loading State
Show full‑screen overlay with spinner and descriptive text during asynchronous operations (e.g., fetching data).

Disable buttons that trigger actions while loading.

8.2 Empty State
Display a centered message in the table/card area:

html
<td colspan="..." class="px-4 py-8 text-center text-gray-500 italic">No items found.</td>
8.3 Error State
Show a toast notification with the error message. In case of severe errors, display an inline error message in the main content area.

9. Implementation Notes
9.1 CSS Framework
Use Tailwind CSS for rapid, consistent styling. The reference component uses Tailwind utilities extensively. For custom CSS (e.g., animations), inject via <style> tag or use a CSS module.

9.2 Animations
The component includes a fade‑in animation for dynamic columns:

css
@keyframes fadeIn {
  from { opacity: 0; transform: translateX(-10px); }
  to { opacity: 1; transform: translateX(0); }
}
.animate-column { animation: fadeIn 0.3s ease-out forwards; }
Use subtle animations to enhance user experience without distraction.

9.3 Spacing & Sizing
Use Tailwind’s spacing scale (e.g., p-4, gap-3).

For table cells, use px-6 py-4 for comfortable touch targets.

For card padding, use p-4 on mobile, p-6 on desktop.

9.4 Form Labels
Always place labels above inputs (not placeholders) for accessibility. Use block text-[10px] font-bold text-primary mb-1 uppercase for small labels.

9.5 Icons
Use Lucide React (lucide-react) as shown in the component. Ensure icons have aria-hidden="true" and are accompanied by visible text or aria-label.

10. Example Patterns from DispatchPlanning Component
10.1 Filter Row with Searchable Dropdowns
The component uses a grid of inputs and custom SearchableDropdown components. Each dropdown supports an "All" option and search within options. Implement with similar styling.

10.2 Bulk Actions
When rows are selected, new columns appear (Dispatch Qty, Date, etc.). This is achieved by conditionally rendering {isAnySelected && (...)} inside the table header and rows. The same concept applies to any bulk operation.

10.3 Sorting
Implement sorting with clickable headers that toggle asc/desc. Use a custom SortIcon component to indicate active sort.

11. Testing & Validation
Responsiveness: Test on actual devices and browser dev tools (iPhone SE, iPad, 1280px width).

Accessibility: Run Lighthouse audits (target ≥ 90).

Cross‑Browser: Ensure consistency in Chrome, Firefox, Safari, and Edge.

No Console Errors: Verify that no JavaScript errors occur during any interaction.

RTL Support (optional): If needed, add dir="rtl" support.

12. Summary
This UI specification provides a robust foundation for building professional management systems. By adhering to these guidelines, AI agents and developers will create interfaces that are:

Responsive – seamlessly adapting from mobile to desktop.

Accessible – usable by everyone.

Consistent – predictable visual language and behavior.

Error‑free – no layout breakage, no console errors, graceful degradation.

All future UI components and pages must align with this document. Updates to the specification require review and versioning.

