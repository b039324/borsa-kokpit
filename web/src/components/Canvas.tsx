import { GRID_SIZE } from "../config";
import { useSelection } from "../selection";

export function Canvas() {
  const { selected } = useSelection();
  return (
    <main
      className="canvas"
      style={{ backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px` }}
      aria-label="Modül alanı"
    >
      <div className="empty">
        <p>Henüz modül eklenmedi.</p>
        <p className="muted">Seçili hisse: {selected ?? "—"}</p>
      </div>
    </main>
  );
}
