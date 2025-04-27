import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function NotesWidget() {
  const notes = useQuery(api.notes.list) || [];

  return (
    <div className="bg-card rounded-lg border shadow-sm p-6">
      <h2 className="text-xl font-medium text-card-foreground mb-4 font-heading">
        Notes
      </h2>
      <div className="space-y-3">
        {notes.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            No notes yet
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note._id}
              className="p-4 border rounded-md hover:bg-muted/30 transition-colors"
              style={{
                backgroundColor: (note.color || "#3b82f6") + "10",
                borderLeft: `4px solid ${note.color || "#3b82f6"}`,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{note.title}</h3>
                  {note.isPinned && <span className="text-amber-500">📌</span>}
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary">
                  {note.category || "other"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {note.content}
              </p>
              <div className="flex items-center justify-between mt-3">
                <div className="flex flex-wrap gap-1">
                  {note.tags &&
                    note.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-secondary px-2 py-0.5 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                </div>
                <span className="text-xs text-muted-foreground">
                  {note.lastModified
                    ? new Date(note.lastModified).toLocaleDateString()
                    : ""}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
