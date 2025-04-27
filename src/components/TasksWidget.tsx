import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import { Separator } from "./ui/separator";
import { CheckIcon, ListIcon, KanbanIcon } from "lucide-react";

type ViewType = "kanban" | "list";

export function TasksWidget() {
  const [view, setView] = useState<ViewType>("kanban");
  const tasks = useQuery(api.tasks.list) || [];
  const toggleTask = useMutation(api.tasks.toggle);
  const updateTaskStatus = useMutation(api.tasks.updateStatus);

  const getPriorityColor = (priority: string | undefined) => {
    switch (priority) {
      case "high":
        return "bg-destructive/20 text-destructive hover:bg-destructive/20";
      case "medium":
        return "bg-amber-100 text-amber-600 hover:bg-amber-100";
      case "low":
        return "bg-emerald-100 text-emerald-600 hover:bg-emerald-100";
      default:
        return "bg-secondary text-secondary-foreground hover:bg-secondary";
    }
  };

  const handleDragStart = (e: React.DragEvent, taskId: Id<"tasks">) => {
    e.dataTransfer.setData("taskId", taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, status: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId") as Id<"tasks">;
    void updateTaskStatus({ id: taskId, status });
  };

  const TaskCard = ({ task }: { task: Doc<"tasks"> }) => (
    <Card
      key={task._id}
      draggable
      onDragStart={(e) => handleDragStart(e, task._id)}
      className="cursor-move hover:shadow-md transition-shadow"
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Checkbox
            checked={task.completed}
            onCheckedChange={() => {
              void toggleTask({ id: task._id });
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <span
            className={
              task.completed
                ? "line-through text-muted-foreground"
                : "font-medium"
            }
          >
            {task.title}
          </span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <Badge className={`${getPriorityColor(task.priority)}`}>
            {task.priority || "medium"}
          </Badge>
        </div>
        {task.description && (
          <p className="text-sm text-muted-foreground mb-2">
            {task.description}
          </p>
        )}
        {task.dueDate && (
          <p className="text-xs text-muted-foreground">
            Due: {new Date(task.dueDate).toLocaleDateString()}
          </p>
        )}
        {task.tags && task.tags.length > 0 && (
          <div className="flex gap-1 mt-2 flex-wrap">
            {task.tags.map((tag) => (
              <Badge
                key={tag}
                className="text-xs bg-secondary text-secondary-foreground"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const KanbanView = () => {
    const columns = {
      todo: tasks.filter(
        (t) => (!t.status || t.status === "todo") && !t.completed
      ),
      in_progress: tasks.filter(
        (t) => t.status === "in_progress" && !t.completed
      ),
      done: tasks.filter((t) => t.completed),
    };

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(columns).map(([status, columnTasks]) => (
          <div
            key={status}
            className="bg-muted/50 p-4 rounded-lg"
            onDragOver={handleDragOver}
            onDrop={(e) => {
              void handleDrop(e, status);
            }}
          >
            <h3 className="text-sm font-medium mb-4 capitalize flex items-center">
              <span>{status.replace("_", " ")}</span>
              <Badge className="ml-2">{columnTasks.length}</Badge>
            </h3>
            <div className="space-y-3">
              {columnTasks.map((task) => (
                <TaskCard key={task._id} task={task} />
              ))}
              {columnTasks.length === 0 && (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No tasks
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const ListView = () => (
    <div className="space-y-2">
      {tasks.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          No tasks yet
        </div>
      ) : (
        tasks.map((task) => (
          <Card key={task._id} className="transition-colors">
            <CardContent className="p-3 flex items-start gap-3">
              <Checkbox
                checked={task.completed}
                onCheckedChange={() => {
                  void toggleTask({ id: task._id });
                }}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={
                      task.completed
                        ? "line-through text-muted-foreground"
                        : "font-medium"
                    }
                  >
                    {task.title}
                  </span>
                  <Badge className={`${getPriorityColor(task.priority)}`}>
                    {task.priority || "medium"}
                  </Badge>
                  <Badge>{task.status || "todo"}</Badge>
                </div>
                {task.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {task.description}
                  </p>
                )}
                {task.dueDate && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Due: {new Date(task.dueDate).toLocaleDateString()}
                  </p>
                )}
                {task.tags && task.tags.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {task.tags.map((tag) => (
                      <Badge
                        key={tag}
                        className="text-xs bg-secondary text-secondary-foreground"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-heading">Tasks</CardTitle>
          <Tabs
            value={view}
            onValueChange={(v) => setView(v as ViewType)}
            className="w-[200px]"
          >
            <TabsList>
              <TabsTrigger value="kanban" className="flex items-center gap-1">
                <KanbanIcon className="h-4 w-4" />
                <span>Kanban</span>
              </TabsTrigger>
              <TabsTrigger value="list" className="flex items-center gap-1">
                <ListIcon className="h-4 w-4" />
                <span>List</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="pt-6">
        {view === "kanban" ? <KanbanView /> : <ListView />}
      </CardContent>
    </Card>
  );
}
