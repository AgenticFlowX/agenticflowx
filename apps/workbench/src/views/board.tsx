/**
 * Board view entrypoint.
 *
 * The revision-aware Board V2 implementation is the only active renderer.
 * Keeping this small compatibility module preserves the existing lazy import
 * path without shipping the retired fire-and-forget implementation.
 *
 * @see docs/specs/221-app-workbench-board/spec.md [FR-1] [FR-7] [FR-8] [FR-9] [FR-10]
 * @see docs/specs/221-app-workbench-board/design.md [DES-BOARD-TOOLBAR] [DES-BOARD-CARD] [DES-BOARD-COLUMN] [DES-BOARD-SAVE] [DES-BOARD-STABILITY] [DES-BOARD-EMPTY]
 */
export { default } from "./board-v2";
