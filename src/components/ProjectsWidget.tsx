import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { Separator } from "./ui/separator";
import { Progress } from "./ui/progress";
import { ListIcon, KanbanIcon } from "lucide-react";

type ViewType = "kanban" | "list";

export function ProjectsWidget() {
  const [view, setView] = useState<ViewType>("kanban");
  const projects = useQuery(api.projects.list) || [];
  const updateProjectStatus = useMutation(api.projects.updateStatus);

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case "planning":
        return "bg-blue-100 text-blue-600";
      case "in_progress":
        return "bg-amber-100 text-amber-600";
      case "review":
        return "bg-purple-100 text-purple-600";
      case "completed":
        return "bg-emerald-100 text-emerald-600";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getPriorityColor = (priority: string | undefined) => {
    switch (priority) {
      case "high":
        return "bg-destructive/20 text-destructive";
      case "medium":
        return "bg-amber-100 text-amber-600";
      case "low":
        return "bg-emerald-100 text-emerald-600";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const handleDragStart = (e: React.DragEvent, projectId: Id<"projects">) => {
    e.dataTransfer.setData("projectId", projectId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, status: string) => {
    e.preventDefault();
    const projectId = e.dataTransfer.getData("projectId") as Id<"projects">;
    void updateProjectStatus({ id: projectId, status });
  };

  const calculateProgress = (progress?: number): string => {
    if (progress === undefined) return "0%";
    return `${Math.min(100, Math.max(0, progress))}%`;
  };

  const getProgressValue = (progress?: number): number => {
    if (progress === undefined) return 0;
    return Math.min(100, Math.max(0, progress));
  };

  const ProjectCard = ({ project }: { project: Doc<"projects"> }) => (
    <Card
      key={project._id}
      draggable
      onDragStart={(e) => handleDragStart(e, project._id)}
      className="cursor-move hover:shadow-md transition-shadow"
    >
      <CardContent className="p-4">
        <div className="mb-2">
          <div className="flex justify-between items-start">
            <h3 className="font-medium text-foreground">{project.title}</h3>
            <Badge className={getPriorityColor(project.priority)}>
              {project.priority || "medium"}
            </Badge>
          </div>
          {project.description && (
            <p className="text-sm text-muted-foreground mt-1">
              {project.description}
            </p>
          )}
        </div>

        <div className="mt-3">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Progress</span>
            <span>{calculateProgress(project.progress)}</span>
          </div>
          <Progress
            value={getProgressValue(project.progress)}
            className="h-1.5"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {project.startDate && (
            <span className="text-xs text-muted-foreground">
              Start: {new Date(project.startDate).toLocaleDateString()}
            </span>
          )}
          {project.dueDate && (
            <span className="text-xs text-muted-foreground">
              Due: {new Date(project.dueDate).toLocaleDateString()}
            </span>
          )}
        </div>

        {project.tags && project.tags.length > 0 && (
          <div className="flex gap-1 mt-2 flex-wrap">
            {project.tags.map((tag) => (
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
      planning: projects.filter((p) => !p.status || p.status === "planning"),
      in_progress: projects.filter((p) => p.status === "in_progress"),
      review: projects.filter((p) => p.status === "review"),
      completed: projects.filter((p) => p.status === "completed"),
    };

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(columns).map(([status, columnProjects]) => (
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
              <Badge className="ml-2">{columnProjects.length}</Badge>
            </h3>
            <div className="space-y-3">
              {columnProjects.map((project) => (
                <ProjectCard key={project._id} project={project} />
              ))}
              {columnProjects.length === 0 && (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No projects
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
      {projects.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          No projects yet
        </div>
      ) : (
        projects.map((project) => (
          <Card key={project._id} className="transition-colors">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <h3 className="font-medium text-foreground">{project.title}</h3>
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(project.status)}>
                    {project.status || "planning"}
                  </Badge>
                  <Badge className={getPriorityColor(project.priority)}>
                    {project.priority || "medium"}
                  </Badge>
                </div>
              </div>

              {project.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {project.description}
                </p>
              )}

              <div className="mt-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Progress</span>
                  <span>{calculateProgress(project.progress)}</span>
                </div>
                <Progress
                  value={getProgressValue(project.progress)}
                  className="h-1.5"
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {project.startDate && (
                  <span className="text-xs text-muted-foreground">
                    Start: {new Date(project.startDate).toLocaleDateString()}
                  </span>
                )}
                {project.dueDate && (
                  <span className="text-xs text-muted-foreground">
                    Due: {new Date(project.dueDate).toLocaleDateString()}
                  </span>
                )}
              </div>

              {project.tags && project.tags.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {project.tags.map((tag) => (
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
        ))
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-heading">Projects</CardTitle>
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
