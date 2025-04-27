import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useToast } from "../hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import {
  CalendarIcon,
  ClipboardIcon,
  CalendarDaysIcon,
  BookmarkIcon,
  FileTextIcon,
  LucideIcon,
} from "lucide-react";

type CaptureType = "task" | "project" | "event" | "note" | "bookmark";

interface CaptureTypeConfig {
  icon: LucideIcon;
  label: string;
}

const typeConfig: Record<CaptureType, CaptureTypeConfig> = {
  task: {
    icon: ClipboardIcon,
    label: "Task",
  },
  project: {
    icon: CalendarDaysIcon,
    label: "Project",
  },
  event: {
    icon: CalendarIcon,
    label: "Event",
  },
  note: {
    icon: FileTextIcon,
    label: "Note",
  },
  bookmark: {
    icon: BookmarkIcon,
    label: "Bookmark",
  },
};

export function QuickCapture() {
  const { toast } = useToast();
  const [type, setType] = useState<CaptureType>("task");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("personal");
  const [tags, setTags] = useState("");
  const [location, setLocation] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);
  const [color, setColor] = useState("#007AFF");

  const createTask = useMutation(api.tasks.create);
  const createProject = useMutation(api.projects.create);
  const createEvent = useMutation(api.events.create);
  const createNote = useMutation(api.notes.create);
  const createBookmark = useMutation(api.bookmarks.create);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const tagArray = tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

      switch (type) {
        case "task":
          await createTask({
            title,
            description,
            priority,
            status: "todo",
            tags: tagArray,
            dueDate: startDate ? new Date(startDate).getTime() : undefined,
          });
          break;
        case "project":
          await createProject({
            title,
            description,
            priority,
            status: "planning",
            category,
            tags: tagArray,
            progress: 0,
            startDate: startDate ? new Date(startDate).getTime() : undefined,
            dueDate: endDate ? new Date(endDate).getTime() : undefined,
          });
          break;
        case "event":
          await createEvent({
            title,
            description,
            startDate: new Date(startDate).getTime(),
            endDate: new Date(endDate).getTime(),
            location,
            category,
            isAllDay,
            isRecurring: false,
            tags: tagArray,
            color,
          });
          break;
        case "note":
          await createNote({
            title,
            content: description,
            category,
            tags: tagArray,
            isPinned: false,
            color,
          });
          break;
        case "bookmark":
          await createBookmark({
            title,
            url,
            description,
            category,
            tags: tagArray,
            isArchived: false,
          });
          break;
      }

      // Reset form
      setTitle("");
      setDescription("");
      setUrl("");
      setStartDate("");
      setEndDate("");
      setTags("");
      setLocation("");
      setPriority("medium");
      setCategory("personal");
      setIsAllDay(false);
      setColor("#007AFF");

      toast({
        title: "Success",
        description: "Item created successfully!",
      });
    } catch (err) {
      console.error("Failed to create item:", err);
      toast({
        title: "Error",
        description: `Failed to create item: ${err instanceof Error ? err.message : "Unknown error"}`,
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Quick Capture</CardTitle>
        <CardDescription>
          Capture your thoughts, tasks, and ideas quickly
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit(e);
          }}
          className="space-y-6"
        >
          <Tabs
            value={type}
            onValueChange={(value) => setType(value as CaptureType)}
            className="w-full"
          >
            <TabsList className="grid grid-cols-5 w-full h-12 bg-muted">
              {(Object.keys(typeConfig) as CaptureType[]).map((t) => {
                const Icon = typeConfig[t].icon;
                return (
                  <TabsTrigger
                    key={t}
                    value={t}
                    className="flex items-center justify-center gap-2 h-full py-2"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {typeConfig[t].label}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                type="text"
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            {type !== "bookmark" && (
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            {type === "bookmark" && (
              <div className="grid gap-2">
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="work">Work</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                  <SelectItem value="health">Health</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(type === "task" || type === "project") && (
              <div className="grid gap-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low Priority</SelectItem>
                    <SelectItem value="medium">Medium Priority</SelectItem>
                    <SelectItem value="high">High Priority</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {(type === "task" || type === "project" || type === "event") && (
              <div className="grid gap-2">
                <Label htmlFor="startDate">
                  {type === "task" ? "Due Date" : "Start Date"}
                </Label>
                <Input
                  id="startDate"
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required={type === "event"}
                />
              </div>
            )}

            {(type === "project" || type === "event") && (
              <div className="grid gap-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required={type === "event"}
                />
              </div>
            )}

            {type === "event" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    type="text"
                    placeholder="Location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
                <div className="flex items-center space-x-2 h-10 mt-8">
                  <Checkbox
                    id="isAllDay"
                    checked={isAllDay}
                    onCheckedChange={(checked) =>
                      setIsAllDay(checked === true ? true : false)
                    }
                  />
                  <Label htmlFor="isAllDay">All day event</Label>
                </div>
              </>
            )}

            {(type === "note" || type === "event") && (
              <div className="grid gap-2">
                <Label htmlFor="color">Color</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="color"
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-12 h-10 p-1"
                  />
                  <span className="text-sm">{color.toUpperCase()}</span>
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tags">Tags (comma separated)</Label>
            <Input
              id="tags"
              type="text"
              placeholder="tag1, tag2, tag3"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>

          <Button type="submit" className="w-full">
            Create {typeConfig[type].label}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
