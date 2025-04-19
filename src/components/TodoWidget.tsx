import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Doc } from "../../convex/_generated/dataModel";

export function TodoWidget() {
  const tasks = useQuery(api.tasks.list);
  const [newTask, setNewTask] = useState("");
  const createTask = useMutation(api.tasks.create);
  const updateTask = useMutation(api.tasks.update);
  const deleteTask = useMutation(api.tasks.remove);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;

    await createTask({
      title: newTask,
      description: "",
      status: "todo",
      priority: "medium",
      tags: [],
    });
    setNewTask("");
  };

  const handleToggleComplete = async (task: Doc<"tasks">) => {
    await updateTask({
      id: task._id,
      status: task.status === "todo" ? "completed" : "todo",
    });
  };

  const handleDeleteTask = async (id: string) => {
    await deleteTask({ id });
  };

  const pendingTasks = tasks?.filter((t) => t.status === "todo") || [];
  const completedTasks = tasks?.filter((t) => t.status === "completed") || [];

  return (
    <div className="apple-card h-full flex flex-col">
      <div className="p-5 border-b border-white/20">
        <h2 className="text-xl font-medium text-foreground">Tasks</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your daily tasks and to-dos
        </p>
      </div>

      <div className="flex-1 overflow-auto p-5">
        <form onSubmit={handleCreateTask} className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Add a new task..."
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            className="flex-1 h-10 rounded-[var(--radius)] border border-white/30 bg-white/70 backdrop-blur-sm px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
            style={{ boxShadow: "var(--apple-shadow-sm)" }}
          />
          <button
            type="submit"
            disabled={!newTask.trim()}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius)] bg-accent h-10 px-4 text-sm font-medium text-accent-foreground shadow hover:bg-accent/90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            style={{ boxShadow: "var(--apple-shadow-sm)" }}
          >
            Add
          </button>
        </form>

        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Pending ({pendingTasks.length})
            </h3>
            {pendingTasks.length === 0 ? (
              <div className="apple-glass rounded-[var(--radius)] p-4 text-sm text-muted-foreground italic">
                No pending tasks
              </div>
            ) : (
              <ul className="space-y-2">
                {pendingTasks.map((task) => (
                  <li
                    key={task._id}
                    className="group apple-glass rounded-[var(--radius)] shadow-sm backdrop-blur-sm border border-white/20 overflow-hidden"
                  >
                    <div className="flex items-center p-3">
                      <button
                        onClick={() => handleToggleComplete(task)}
                        className="flex-shrink-0 h-5 w-5 rounded-full border-2 border-accent mr-3 transition-all hover:bg-accent/20 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
                        aria-label="Mark as complete"
                      >
                        {task.status === "completed" && (
                          <svg
                            className="h-full w-full text-accent"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586l-3.293-3.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </button>
                      <span className="flex-1 text-sm">{task.title}</span>
                      <button
                        onClick={() => handleDeleteTask(task._id)}
                        className="ml-2 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 focus:outline-none"
                        aria-label="Delete task"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                        >
                          <path d="M3 6h18" />
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {completedTasks.length > 0 && (
            <div className="space-y-2 pt-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                Completed ({completedTasks.length})
              </h3>
              <ul className="space-y-2">
                {completedTasks.map((task) => (
                  <li
                    key={task._id}
                    className="group apple-glass rounded-[var(--radius)] shadow-sm backdrop-blur-sm border border-white/20 overflow-hidden opacity-80"
                  >
                    <div className="flex items-center p-3">
                      <button
                        onClick={() => handleToggleComplete(task)}
                        className="flex-shrink-0 h-5 w-5 rounded-full border-2 border-accent mr-3 bg-accent/20 transition-all hover:bg-accent/30 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
                        aria-label="Mark as incomplete"
                      >
                        <svg
                          className="h-full w-full text-accent"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586l-3.293-3.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                      <span className="flex-1 text-sm line-through">
                        {task.title}
                      </span>
                      <button
                        onClick={() => handleDeleteTask(task._id)}
                        className="ml-2 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 focus:outline-none"
                        aria-label="Delete task"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                        >
                          <path d="M3 6h18" />
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
