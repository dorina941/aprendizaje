"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  Plus,
  Link as LinkIcon,
  Save,
  Trash2,
  Pencil,
  Download,
  Upload,
  Search,
  Calendar as CalendarIcon,
  ArrowUpRight,
  FileText,
  Undo2,
  Redo2,
  Clock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// shadcn/ui
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type LinkItem = { id: string; url: string; title?: string };

type Entry = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  notes: string;
  tags: string[];
  links: LinkItem[];
};

type VideoStatus = "not_seen" | "watched" | "mastered";

type LearningChecklistItem = {
  id: string;
  text: string;
  done: boolean;
};

type RecommendedVideo = {
  id: string;
  title: string;
  description: string;
  duration: string;
  status: VideoStatus;
  url: string;
  checklist: LearningChecklistItem[];
};

const VIDEO_STATUS_LABELS: Record<VideoStatus, string> = {
  not_seen: "No lo vi aún",
  watched: "Ya lo vi",
  mastered: "Ya lo aprendí todo",
};

const VIDEO_STATUS_BADGE_CLASSES: Record<VideoStatus, string> = {
  not_seen: "bg-slate-200 text-slate-700",
  watched: "bg-sky-100 text-sky-800",
  mastered: "bg-emerald-100 text-emerald-800",
};

const STORAGE_KEY = "learning-journal-v1";
const SETTINGS_KEY = "learning-journal-settings";
const VIDEO_STORAGE_KEY = "learning-journal-recommended-videos-v1";

const DEFAULT_RECOMMENDED_VIDEOS: RecommendedVideo[] = [
  {
    id: "tal-01",
    title: "TAL",
    description: "Video sobre tal cosa (actualiza esta nota con más contexto).",
    duration: "45 min",
    status: "not_seen",
    url: "",
    checklist: [],
  },
  {
    id: "tal-02",
    title: "TAL",
    description:
      "Revisión de tal cosa para el equipo — actualiza con la información correcta.",
    duration: "1 h",
    status: "not_seen",
    url: "",
    checklist: [],
  },
  {
    id: "tal-03",
    title: "TAL",
    description:
      "Charla recomendada para tal cosa. Completa los detalles cuando los tengas.",
    duration: "30 min",
    status: "not_seen",
    url: "",
    checklist: [],
  },
];

function createEmptyVideo(): RecommendedVideo {
  return {
    id: uuidv4(),
    title: "",
    description: "",
    duration: "",
    status: "not_seen",
    url: "",
    checklist: [],
  };
}

function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(key) : null;
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);
  return [value, setValue] as const;
}

function parseTags(text: string): string[] {
  return text
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t.slice(1) : t))
    .map((t) => t.toLowerCase());
}

function formatDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, day || 1);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function exportJSON(entries: Entry[]) {
  const blob = new Blob([JSON.stringify(entries, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `apuntes-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportMarkdown(entries: Entry[]) {
  const header = `# Diario de aprendizaje\n\nGenerado: ${new Date().toLocaleString()}\n\n`;
  const body = entries
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((e) => {
      const tags = e.tags.map((t) => `#${t}`).join(" ");
      const links = e.links
        .map((l) => `- [${l.title || l.url}](${l.url})`)
        .join("\n");
      return `## ${formatDate(e.date)} — ${e.title}\n\n${tags}\n\n${e.notes}\n\n**Enlaces**\n\n${
        links || "(sin enlaces)"
      }\n`;
    })
    .join("\n\n");
  const blob = new Blob([header + body], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `apuntes-${new Date().toISOString().slice(0, 10)}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

function fileOpenJSON(onLoad: (data: Entry[]) => void) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      if (Array.isArray(data)) onLoad(data);
      else alert("El JSON no tiene el formato esperado.");
    } catch {
      alert("No se pudo leer el JSON.");
    }
  };
  input.click();
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export default function Page() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-800 p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <LearningJournalApp />
      </div>
    </main>
  );
}

function LearningJournalApp() {
  const [entries, setEntries] = useLocalStorage<Entry[]>(STORAGE_KEY, []);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [settings, setSettings] = useLocalStorage(SETTINGS_KEY, {
    compact: false,
  });
  const [recommendedVideos, setRecommendedVideos] = useLocalStorage<RecommendedVideo[]>(
    VIDEO_STORAGE_KEY,
    DEFAULT_RECOMMENDED_VIDEOS
  );

  const allTags = useMemo(
    () => uniq(entries.flatMap((e) => e.tags)).sort(),
    [entries]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries
      .filter((e) => !tagFilter || e.tags.includes(tagFilter))
      .filter(
        (e) =>
          !q ||
          [e.title, e.notes, e.tags.join(" "), e.links.map((l) => l.title || l.url).join(" ")]
            .join(" ")
            .toLowerCase()
            .includes(q)
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, query, tagFilter]);

  function startNew() {
    const today = new Date().toISOString().slice(0, 10);
    setEditing({
      id: uuidv4(),
      date: today,
      title: "",
      notes: "",
      tags: [],
      links: [],
    });
  }

  function saveEntry(entry: Entry) {
    setEntries((prev) => {
      const exists = prev.some((p) => p.id === entry.id);
      const next = exists
        ? prev.map((p) => (p.id === entry.id ? entry : p))
        : [...prev, entry];
      return next;
    });
    setEditing(null);
  }

  function deleteEntry(id: string) {
    if (!confirm("¿Eliminar esta entrada?")) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function clearAll() {
    if (!confirm("Esto borrará todas tus entradas locales. ¿Seguro?")) return;
    setEntries([]);
  }

  // Undo/Redo simple
  const historyRef = useRef<Entry[][]>([]);
  const futureRef = useRef<Entry[][]>([]);
  useEffect(() => {
    historyRef.current.push(entries);
    if (historyRef.current.length > 50) historyRef.current.shift();
  }, [entries]);
  const undo = () => {
    const hist = historyRef.current;
    if (hist.length <= 1) return;
    const current = hist.pop();
    if (!current) return;
    futureRef.current.push(current);
    setEntries(hist[hist.length - 1] || []);
  };
  const redo = () => {
    const next = futureRef.current.pop();
    if (!next) return;
    setEntries(next);
  };

  return (
    <TooltipProvider>
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Diario de Aprendizaje
          </h1>
          <p className="text-slate-500">
            Guarda cada día lo que aprendiste en la empresa, con enlaces a
            videos y recursos. Sin backend: todo queda en tu navegador.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" onClick={undo}>
                <Undo2 className="h-4 w-4 mr-2" />
                Deshacer
              </Button>
            </TooltipTrigger>
            <TooltipContent>Deshacer último cambio</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" onClick={redo}>
                <Redo2 className="h-4 w-4 mr-2" />
                Rehacer
              </Button>
            </TooltipTrigger>
            <TooltipContent>Rehacer cambio</TooltipContent>
          </Tooltip>
          <Button onClick={startNew}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva entrada
          </Button>
        </div>
      </header>

      <RecommendedVideosSection
        videos={recommendedVideos}
        onChange={setRecommendedVideos}
      />

      <Separator className="my-8" />

      <Card className="mb-4">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex items-center gap-2">
            <Search className="h-4 w-4" />
            <Input
              placeholder="Buscar título, notas, enlaces…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto">
            <Badge
              variant={tagFilter === null ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setTagFilter(null)}
            >
              Todas
            </Badge>
            {allTags.map((t) => (
              <Badge
                key={t}
                variant={tagFilter === t ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setTagFilter(t)}
              >
                #{t}
              </Badge>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={() => exportMarkdown(filtered)}>
                  <FileText className="h-4 w-4 mr-2" />
                  MD
                </Button>
              </TooltipTrigger>
              <TooltipContent>Exportar Markdown</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={() => exportJSON(entries)}>
                  <Download className="h-4 w-4 mr-2" />
                  JSON
                </Button>
              </TooltipTrigger>
              <TooltipContent>Exportar JSON (copia de seguridad)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={() => fileOpenJSON(setEntries)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar
                </Button>
              </TooltipTrigger>
              <TooltipContent>Importar desde JSON</TooltipContent>
            </Tooltip>
            <Separator orientation="vertical" className="h-6" />
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 px-2">
                  <span className="text-sm text-slate-600">Vista compacta</span>
                  <Switch
                    checked={settings.compact}
                    onCheckedChange={(v) =>
                      setSettings({ ...settings, compact: v })
                    }
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>Alterna lista compacta</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="destructive" onClick={clearAll}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Borrar todo
                </Button>
              </TooltipTrigger>
              <TooltipContent>Eliminar todas las entradas (local)</TooltipContent>
            </Tooltip>
          </div>
        </CardContent>
      </Card>

      <div className={`grid gap-4 ${settings.compact ? "grid-cols-1" : "md:grid-cols-2"}`}>
        <AnimatePresence>
          {filtered.map((e) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <Card className="group">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span className="truncate">{e.title || "(Sin título)"} </span>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="sm" variant="outline" onClick={() => setEditing(e)}>
                        <Pencil className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteEntry(e.id)}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Eliminar
                      </Button>
                    </div>
                  </CardTitle>
                  <div className="text-sm text-slate-500 flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {formatDate(e.date)}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {e.tags.map((t) => (
                      <Badge
                        key={t}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => setTagFilter(t)}
                      >
                        #{t}
                      </Badge>
                    ))}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{e.notes}</p>
                  {e.links.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {e.links.map((l) => (
                        <a
                          key={l.id}
                          href={l.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 text-sm underline"
                        >
                          <ArrowUpRight className="h-4 w-4" />
                          <span className="truncate">{l.title || l.url}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing?.id && entries.find((e) => e.id === editing.id)
                ? "Editar entrada"
                : "Nueva entrada"}
            </DialogTitle>
            <DialogDescription>
              Completa los datos del día y guarda. Todo se almacena en tu navegador.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <EntryForm value={editing} onChange={setEditing} onSave={() => saveEntry(editing)} />
          )}
        </DialogContent>
      </Dialog>

      <footer className="text-xs text-slate-400 mt-8 text-center">
        Hecho con ♥ sin backend — usa Exportar JSON como copia de seguridad.
      </footer>
    </TooltipProvider>
  );
}

function RecommendedVideosSection({
  videos,
  onChange,
}: {
  videos: RecommendedVideo[];
  onChange: React.Dispatch<React.SetStateAction<RecommendedVideo[]>>;
}) {
  const [editing, setEditing] = useState<RecommendedVideo | null>(null);
  const [checklistDrafts, setChecklistDrafts] = useState<Record<string, string>>({});

  const openNewVideo = () => {
    setEditing(createEmptyVideo());
  };

  const saveVideo = (video: RecommendedVideo) => {
    onChange((prev) => {
      const exists = prev.some((p) => p.id === video.id);
      return exists
        ? prev.map((p) => (p.id === video.id ? { ...video } : p))
        : [...prev, { ...video }];
    });
    setEditing(null);
  };

  const deleteVideo = (id: string) => {
    if (!confirm("¿Eliminar este video recomendado?")) return;
    onChange((prev) => prev.filter((video) => video.id !== id));
    setChecklistDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const updateVideo = (id: string, patch: Partial<RecommendedVideo>) => {
    onChange((prev) =>
      prev.map((video) => (video.id === id ? { ...video, ...patch } : video))
    );
  };

  const updateChecklist = (videoId: string, items: LearningChecklistItem[]) => {
    onChange((prev) =>
      prev.map((video) =>
        video.id === videoId ? { ...video, checklist: items } : video
      )
    );
  };

  const toggleChecklistItem = (videoId: string, itemId: string) => {
    const video = videos.find((v) => v.id === videoId);
    if (!video) return;
    updateChecklist(
      videoId,
      video.checklist.map((item) =>
        item.id === itemId ? { ...item, done: !item.done } : item
      )
    );
  };

  const removeChecklistItem = (videoId: string, itemId: string) => {
    const video = videos.find((v) => v.id === videoId);
    if (!video) return;
    updateChecklist(
      videoId,
      video.checklist.filter((item) => item.id !== itemId)
    );
  };

  const addChecklistItem = (videoId: string) => {
    const raw = (checklistDrafts[videoId] || "").trim();
    if (!raw) return;
    const video = videos.find((v) => v.id === videoId);
    if (!video) return;
    const newItem: LearningChecklistItem = {
      id: uuidv4(),
      text: raw,
      done: false,
    };
    updateChecklist(videoId, [...video.checklist, newItem]);
    setChecklistDrafts((prev) => ({ ...prev, [videoId]: "" }));
  };

  const handleStatusChange = (videoId: string, status: VideoStatus) => {
    updateVideo(videoId, { status });
  };

  return (
    <section className="mb-10">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-4">
        <div>
          <h2 className="text-2xl font-semibold">Videos recomendados</h2>
          <p className="text-sm text-slate-500">
            Guarda aquí los enlaces que la empresa recomienda y marca tus avances.
          </p>
        </div>
        <Button onClick={openNewVideo}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo video
        </Button>
      </div>

      {videos.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-500">
            Aún no hay videos recomendados. Añade el primero con el botón superior.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {videos.map((video) => (
            <Card key={video.id} className="group">
              <CardHeader className="pb-3">
                <CardTitle className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-lg font-semibold">
                      {video.title || "(Sin título)"}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${VIDEO_STATUS_BADGE_CLASSES[video.status]}`}
                    >
                      {VIDEO_STATUS_LABELS[video.status]}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <Clock className="h-4 w-4" />
                    <span>{video.duration || "Duración no especificada"}</span>
                  </div>
                </CardTitle>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEditing({
                        ...video,
                        checklist: video.checklist.map((item) => ({ ...item })),
                      })
                    }
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteVideo(video.id)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-600 leading-relaxed">
                  {video.description || "Añade una descripción para recordar de qué va la charla."}
                </p>
                <div className="flex flex-col gap-2">
                  <Label className="text-xs uppercase tracking-wide text-slate-500">
                    Estado
                  </Label>
                  <select
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                    value={video.status}
                    onChange={(e) =>
                      handleStatusChange(video.id, e.target.value as VideoStatus)
                    }
                  >
                    {Object.entries(VIDEO_STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                {video.url ? (
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-slate-700 underline"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                    Abrir video
                  </a>
                ) : (
                  <p className="text-xs text-slate-400">
                    Agrega un enlace para poder abrir el video desde aquí.
                  </p>
                )}
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                    Checklist de aprendizajes
                  </p>
                  <div className="space-y-2">
                    {video.checklist.length === 0 && (
                      <p className="text-xs text-slate-400">
                        Añade ítems para recordar qué aprendiste.
                      </p>
                    )}
                    {video.checklist.map((item) => (
                      <div key={item.id} className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-600 focus:ring-slate-400"
                          checked={item.done}
                          onChange={() => toggleChecklistItem(video.id, item.id)}
                        />
                        <span
                          className={`text-sm ${
                            item.done ? "text-slate-400 line-through" : "text-slate-600"
                          }`}
                        >
                          {item.text}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="ml-auto text-slate-400 hover:text-slate-600"
                          onClick={() => removeChecklistItem(video.id, item.id)}
                          aria-label="Eliminar ítem de checklist"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <form
                    className="mt-3 flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      addChecklistItem(video.id);
                    }}
                  >
                    <Input
                      placeholder='Ej. "Comprendí el flujo de autenticación"'
                      value={checklistDrafts[video.id] ?? ""}
                      onChange={(e) =>
                        setChecklistDrafts((prev) => ({ ...prev, [video.id]: e.target.value }))
                      }
                    />
                    <Button type="submit" variant="outline">
                      Añadir
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editing?.id && videos.some((v) => v.id === editing.id)
                ? "Editar video recomendado"
                : "Nuevo video recomendado"}
            </DialogTitle>
            <DialogDescription>
              Completa los datos del video recomendado. Se guardan localmente en tu navegador.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <VideoForm
              value={editing}
              onChange={setEditing}
              onSave={() => saveVideo(editing)}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function VideoForm({
  value,
  onChange,
  onSave,
  onCancel,
}: {
  value: RecommendedVideo;
  onChange: (v: RecommendedVideo) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  function update<K extends keyof RecommendedVideo>(key: K, v: RecommendedVideo[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
        <Label>Título</Label>
        <div className="sm:col-span-2">
          <Input
            placeholder="p. ej. Fundamentos de diseño de sistemas"
            value={value.title}
            onChange={(e) => update("title", e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
        <Label>Descripción</Label>
        <div className="sm:col-span-2">
          <Textarea
            placeholder="Contexto sobre por qué ver este video, ideas clave, etc."
            value={value.description}
            onChange={(e) => update("description", e.target.value)}
            className="min-h-[120px]"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
        <Label>Duración</Label>
        <div className="sm:col-span-2">
          <Input
            placeholder="p. ej. 45 min"
            value={value.duration}
            onChange={(e) => update("duration", e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
        <Label>Estado inicial</Label>
        <div className="sm:col-span-2">
          <select
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            value={value.status}
            onChange={(e) => update("status", e.target.value as VideoStatus)}
          >
            {Object.entries(VIDEO_STATUS_LABELS).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
        <Label>Enlace</Label>
        <div className="sm:col-span-2">
          <Input
            placeholder="https://..."
            value={value.url}
            onChange={(e) => update("url", e.target.value)}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={onSave}>
          <Save className="h-4 w-4 mr-2" />
          Guardar video
        </Button>
      </div>
    </div>
  );
}

function EntryForm({
  value,
  onChange,
  onSave,
}: {
  value: any;
  onChange: (v: any) => void;
  onSave: () => void;
}) {
  const [tagText, setTagText] = useState(value.tags.join(", "));

  function update(key: string, v: any) {
    onChange({ ...value, [key]: v });
  }

  function addLink() {
    const newLink: LinkItem = { id: uuidv4(), url: "", title: "" };
    update("links", [...value.links, newLink]);
  }
  function updateLink(id: string, patch: Partial<LinkItem>) {
    update(
      "links",
      value.links.map((l: LinkItem) => (l.id === id ? { ...l, ...patch } : l))
    );
  }
  function removeLink(id: string) {
    update(
      "links",
      value.links.filter((l: LinkItem) => l.id !== id)
    );
  }

  useEffect(() => {
    update("tags", parseTags(tagText));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagText]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
        <Label>Fecha</Label>
        <div className="sm:col-span-2">
          <Input
            type="date"
            value={value.date}
            onChange={(e) => update("date", e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
        <Label>Título</Label>
        <div className="sm:col-span-2">
          <Input
            placeholder="p. ej. Integración de API de pagos"
            value={value.title}
            onChange={(e) => update("title", e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
        <Label>Notas</Label>
        <div className="sm:col-span-2">
          <Textarea
            className="min-h-[160px]"
            placeholder="Qué hiciste hoy, problemas, soluciones, aprendizajes clave…"
            value={value.notes}
            onChange={(e) => update("notes", e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
        <Label>Tags</Label>
        <div className="sm:col-span-2">
          <Input
            placeholder="#frontend, #v0, #node"
            value={tagText}
            onChange={(e) => setTagText(e.target.value)}
          />
          <p className="text-xs text-slate-500 mt-1">
            Separa por comas. Se guardan sin # y en minúsculas.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
        <Label>Enlaces</Label>
        <div className="sm:col-span-2 space-y-2">
          {value.links.map((l: LinkItem) => (
            <div key={l.id} className="flex gap-2 items-center">
              <LinkIcon className="h-4 w-4 shrink-0" />
              <Input
                placeholder="URL (https://...)"
                value={l.url}
                onChange={(e) => updateLink(l.id, { url: e.target.value })}
              />
              <Input
                placeholder="Título opcional"
                value={l.title || ""}
                onChange={(e) => updateLink(l.id, { title: e.target.value })}
              />
              <Button
                variant="destructive"
                size="icon"
                onClick={() => removeLink(l.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" onClick={addLink}>
            <Plus className="h-4 w-4 mr-2" />
            Añadir enlace
          </Button>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <DialogTrigger asChild>
          <Button variant="outline">Cerrar</Button>
        </DialogTrigger>
        <Button onClick={onSave}>
          <Save className="h-4 w-4 mr-2" />
          Guardar
        </Button>
      </div>
    </div>
  );
}
