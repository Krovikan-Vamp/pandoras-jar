import type { CSSProperties, JSX } from "react";
import { useCallback, useEffect, useState } from "react";

import type {
  AudioManifestEntry,
  AudioTake,
  SfxCue,
  VoiceCharacterId,
  VoiceLineCue,
} from "@pithos/audio";

/**
 * Dev-only admin panel for generating/previewing/selecting AI voice & SFX
 * takes. Talks to the `/__audio_admin/*` endpoints exposed by apps/game's
 * Vite dev-server plugin (owned by a sibling workstream) — this component
 * has zero knowledge of ElevenLabs or the filesystem, it just calls fetch.
 */

const STATUS_URL = "/__audio_admin/status";
const CUES_URL = "/__audio_admin/cues";
const GENERATE_URL = "/__audio_admin/generate";
const SELECT_URL = "/__audio_admin/select";

/** Static audio files (generated takes) are served under this prefix by the dev-server plugin. */
const AUDIO_FILES_PREFIX = "/audio-admin-files/";

type CueKind = "voice" | "sfx";

interface AudioAdminStatus {
  providerActive: "elevenlabs" | "mock";
  reason?: string;
}

interface AudioAdminCuesResponse {
  voiceLines: Array<{ cue: VoiceLineCue; manifestEntry: AudioManifestEntry }>;
  sfx: Array<{ cue: SfxCue; manifestEntry: AudioManifestEntry }>;
}

function truncate(text: string, max = 200): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (networkError) {
    throw new Error(
      `Network error calling ${url}: ${networkError instanceof Error ? networkError.message : String(networkError)}`,
    );
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `${url} responded ${response.status} ${response.statusText}${detail ? ` — ${truncate(detail)}` : ""}`,
    );
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(`${url} did not return valid JSON (is the /__audio_admin dev-server plugin running?)`);
  }
}

function resolvePreviewUrl(filePath: string): string {
  if (/^https?:\/\//.test(filePath)) return filePath;
  const normalized = filePath.startsWith("/") ? filePath.slice(1) : filePath;
  return `${AUDIO_FILES_PREFIX}${normalized}`;
}

function groupByCharacter(
  entries: Array<{ cue: VoiceLineCue; manifestEntry: AudioManifestEntry }>,
): Array<[VoiceCharacterId, Array<{ cue: VoiceLineCue; manifestEntry: AudioManifestEntry }>]> {
  const groups = new Map<VoiceCharacterId, Array<{ cue: VoiceLineCue; manifestEntry: AudioManifestEntry }>>();
  for (const entry of entries) {
    const existing = groups.get(entry.cue.characterId);
    if (existing) {
      existing.push(entry);
    } else {
      groups.set(entry.cue.characterId, [entry]);
    }
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function StatusBanner({
  status,
  error,
}: {
  status: AudioAdminStatus | null;
  error: string | undefined;
}): JSX.Element {
  if (error) {
    return <div style={{ ...styles.banner, ...styles.bannerError }}>Could not load provider status: {error}</div>;
  }
  if (!status) {
    return <div style={{ ...styles.banner, ...styles.bannerNeutral }}>Loading provider status…</div>;
  }
  if (status.providerActive === "mock") {
    return (
      <div style={{ ...styles.banner, ...styles.bannerWarning }}>
        <strong>Using placeholder mock audio</strong> — set ELEVENLABS_API_KEY to generate real audio.
        {status.reason ? <div style={styles.bannerDetail}>Reason: {status.reason}</div> : null}
      </div>
    );
  }
  return (
    <div style={{ ...styles.banner, ...styles.bannerOk }}>
      ElevenLabs provider active.
      {status.reason ? <span style={styles.bannerDetail}> {status.reason}</span> : null}
    </div>
  );
}

function TakesList({
  takes,
  selectedTakeId,
  cueId,
  kind,
  onSelect,
  selectingTakeId,
}: {
  takes: AudioTake[];
  selectedTakeId: string | null;
  cueId: string;
  kind: CueKind;
  onSelect: (takeId: string) => void;
  selectingTakeId: string | null;
}): JSX.Element {
  if (takes.length === 0) {
    return <p style={styles.emptyTakes}>No takes generated yet.</p>;
  }
  return (
    <ul style={styles.takesList}>
      {takes.map((take) => {
        const isSelected = take.id === selectedTakeId;
        const isBusy = selectingTakeId === take.id;
        return (
          <li key={take.id} style={{ ...styles.takeRow, ...(isSelected ? styles.takeRowSelected : {}) }}>
            <label style={styles.takeRadioLabel}>
              <input
                type="radio"
                name={`select-${kind}-${cueId}`}
                checked={isSelected}
                disabled={isBusy}
                onChange={() => onSelect(take.id)}
              />
              {isSelected ? "Selected" : isBusy ? "Selecting…" : "Select"}
            </label>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption -- dev tool, not player-facing content */}
            <audio controls src={resolvePreviewUrl(take.filePath)} style={styles.audio} />
            <span style={styles.takeMeta}>
              {take.provider} · {new Date(take.generatedAt).toLocaleString()} · {take.filePath}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function VoiceCueCard({
  cue,
  manifestEntry,
  isGenerating,
  selectingTakeId,
  error,
  onGenerate,
  onSelect,
}: {
  cue: VoiceLineCue;
  manifestEntry: AudioManifestEntry;
  isGenerating: boolean;
  selectingTakeId: string | null;
  error: string | undefined;
  onGenerate: () => void;
  onSelect: (takeId: string) => void;
}): JSX.Element {
  return (
    <div style={styles.cueCard}>
      <div style={styles.cueHeader}>
        <code style={styles.cueId}>{cue.id}</code>
        <button style={styles.generateButton} onClick={onGenerate} disabled={isGenerating}>
          {isGenerating ? "Generating…" : "Generate new take"}
        </button>
      </div>
      <p style={styles.cueText}>&ldquo;{cue.text}&rdquo;</p>
      {cue.context ? <p style={styles.cueContext}>Context: {cue.context}</p> : null}
      {error ? <p style={styles.cueError}>{error}</p> : null}
      <TakesList
        takes={manifestEntry.takes}
        selectedTakeId={manifestEntry.selectedTakeId}
        cueId={cue.id}
        kind="voice"
        onSelect={onSelect}
        selectingTakeId={selectingTakeId}
      />
    </div>
  );
}

function SfxCueCard({
  cue,
  manifestEntry,
  isGenerating,
  selectingTakeId,
  error,
  onGenerate,
  onSelect,
}: {
  cue: SfxCue;
  manifestEntry: AudioManifestEntry;
  isGenerating: boolean;
  selectingTakeId: string | null;
  error: string | undefined;
  onGenerate: () => void;
  onSelect: (takeId: string) => void;
}): JSX.Element {
  return (
    <div style={styles.cueCard}>
      <div style={styles.cueHeader}>
        <code style={styles.cueId}>{cue.id}</code>
        <button style={styles.generateButton} onClick={onGenerate} disabled={isGenerating}>
          {isGenerating ? "Generating…" : "Generate new take"}
        </button>
      </div>
      <p style={styles.cueText}>{cue.description}</p>
      <p style={styles.cueContext}>
        Category: {cue.category}
        {cue.durationSecondsHint ? ` · ~${cue.durationSecondsHint}s` : ""}
      </p>
      {error ? <p style={styles.cueError}>{error}</p> : null}
      <TakesList
        takes={manifestEntry.takes}
        selectedTakeId={manifestEntry.selectedTakeId}
        cueId={cue.id}
        kind="sfx"
        onSelect={onSelect}
        selectingTakeId={selectingTakeId}
      />
    </div>
  );
}

export function AdminAudioPanel(): JSX.Element {
  const [status, setStatus] = useState<AudioAdminStatus | null>(null);
  const [statusError, setStatusError] = useState<string | undefined>(undefined);
  const [cues, setCues] = useState<AudioAdminCuesResponse | null>(null);
  const [cuesError, setCuesError] = useState<string | undefined>(undefined);
  const [cuesLoading, setCuesLoading] = useState(true);
  const [generatingCueId, setGeneratingCueId] = useState<string | null>(null);
  const [selectingTakeId, setSelectingTakeId] = useState<string | null>(null);
  const [actionErrors, setActionErrors] = useState<Record<string, string | undefined>>({});

  const loadStatus = useCallback(async () => {
    try {
      const result = await fetchJson<AudioAdminStatus>(STATUS_URL);
      setStatus(result);
      setStatusError(undefined);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  const loadCues = useCallback(async () => {
    setCuesLoading(true);
    try {
      const result = await fetchJson<AudioAdminCuesResponse>(CUES_URL);
      setCues(result);
      setCuesError(undefined);
    } catch (error) {
      setCuesError(error instanceof Error ? error.message : String(error));
    } finally {
      setCuesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
    void loadCues();
  }, [loadStatus, loadCues]);

  const handleGenerate = useCallback(
    async (cueId: string, kind: CueKind) => {
      setGeneratingCueId(cueId);
      setActionErrors((prev) => ({ ...prev, [cueId]: undefined }));
      try {
        await fetchJson(GENERATE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cueId, kind }),
        });
        await loadCues();
      } catch (error) {
        setActionErrors((prev) => ({ ...prev, [cueId]: error instanceof Error ? error.message : String(error) }));
      } finally {
        setGeneratingCueId(null);
      }
    },
    [loadCues],
  );

  const handleSelect = useCallback(async (cueId: string, kind: CueKind, takeId: string) => {
    setSelectingTakeId(takeId);
    setActionErrors((prev) => ({ ...prev, [cueId]: undefined }));
    try {
      const updatedEntry = await fetchJson<AudioManifestEntry>(SELECT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cueId, kind, takeId }),
      });
      setCues((prev) => {
        if (!prev) return prev;
        if (kind === "voice") {
          return {
            ...prev,
            voiceLines: prev.voiceLines.map((entry) =>
              entry.cue.id === cueId ? { ...entry, manifestEntry: updatedEntry } : entry,
            ),
          };
        }
        return {
          ...prev,
          sfx: prev.sfx.map((entry) => (entry.cue.id === cueId ? { ...entry, manifestEntry: updatedEntry } : entry)),
        };
      });
    } catch (error) {
      setActionErrors((prev) => ({ ...prev, [cueId]: error instanceof Error ? error.message : String(error) }));
    } finally {
      setSelectingTakeId(null);
    }
  }, []);

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>PITHOS Audio Admin</h1>
      <p style={styles.subtitle}>Generate, preview, and lock in AI voice/SFX takes.</p>

      <StatusBanner status={status} error={statusError} />

      {cuesLoading ? <p>Loading cues…</p> : null}
      {cuesError ? (
        <div style={{ ...styles.banner, ...styles.bannerError }}>
          Could not load cues from {CUES_URL}: {cuesError}
          <div style={styles.bannerDetail}>
            This usually means the audio-admin dev-server plugin isn&apos;t wired up yet, or the dev server isn&apos;t
            running.
          </div>
        </div>
      ) : null}

      {cues ? (
        <>
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Voice Lines</h2>
            {cues.voiceLines.length === 0 ? <p>No voice line cues defined.</p> : null}
            {groupByCharacter(cues.voiceLines).map(([characterId, entries]) => (
              <div key={characterId} style={styles.characterGroup}>
                <h3 style={styles.characterHeading}>{characterId}</h3>
                {entries.map(({ cue, manifestEntry }) => (
                  <VoiceCueCard
                    key={cue.id}
                    cue={cue}
                    manifestEntry={manifestEntry}
                    isGenerating={generatingCueId === cue.id}
                    selectingTakeId={selectingTakeId}
                    error={actionErrors[cue.id]}
                    onGenerate={() => void handleGenerate(cue.id, "voice")}
                    onSelect={(takeId) => void handleSelect(cue.id, "voice", takeId)}
                  />
                ))}
              </div>
            ))}
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Sound Effects</h2>
            {cues.sfx.length === 0 ? <p>No SFX cues defined.</p> : null}
            {cues.sfx.map(({ cue, manifestEntry }) => (
              <SfxCueCard
                key={cue.id}
                cue={cue}
                manifestEntry={manifestEntry}
                isGenerating={generatingCueId === cue.id}
                selectingTakeId={selectingTakeId}
                error={actionErrors[cue.id]}
                onGenerate={() => void handleGenerate(cue.id, "sfx")}
                onSelect={(takeId) => void handleSelect(cue.id, "sfx", takeId)}
              />
            ))}
          </section>
        </>
      ) : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    maxWidth: 960,
    margin: "0 auto",
    padding: "24px 16px 64px",
    color: "#1a1a1a",
    background: "#ffffff",
    minHeight: "100vh",
    boxSizing: "border-box",
  },
  title: {
    fontSize: 24,
    marginBottom: 4,
  },
  subtitle: {
    color: "#555",
    marginTop: 0,
    marginBottom: 16,
  },
  banner: {
    borderRadius: 6,
    padding: "10px 14px",
    marginBottom: 20,
    fontSize: 14,
  },
  bannerNeutral: {
    background: "#eee",
    color: "#333",
  },
  bannerWarning: {
    background: "#fff3cd",
    color: "#7a5b00",
    border: "1px solid #ffe08a",
  },
  bannerOk: {
    background: "#e6f4ea",
    color: "#1e5e2e",
    border: "1px solid #b7e1c1",
  },
  bannerError: {
    background: "#fdecea",
    color: "#8a1f11",
    border: "1px solid #f5b5ab",
  },
  bannerDetail: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.85,
  },
  section: {
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 19,
    borderBottom: "1px solid #ddd",
    paddingBottom: 6,
  },
  characterGroup: {
    marginTop: 16,
  },
  characterHeading: {
    fontSize: 15,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#444",
    marginBottom: 8,
  },
  cueCard: {
    border: "1px solid #ddd",
    borderRadius: 8,
    padding: "12px 14px",
    marginBottom: 12,
    background: "#fafafa",
  },
  cueHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cueId: {
    fontSize: 13,
    background: "#eee",
    padding: "2px 6px",
    borderRadius: 4,
  },
  cueText: {
    margin: "8px 0 4px",
    fontSize: 15,
  },
  cueContext: {
    margin: "0 0 6px",
    fontSize: 12,
    color: "#666",
  },
  cueError: {
    margin: "6px 0",
    fontSize: 13,
    color: "#8a1f11",
  },
  generateButton: {
    padding: "6px 12px",
    fontSize: 13,
    cursor: "pointer",
    border: "1px solid #888",
    borderRadius: 4,
    background: "#fff",
  },
  emptyTakes: {
    fontSize: 13,
    color: "#777",
    fontStyle: "italic",
  },
  takesList: {
    listStyle: "none",
    margin: "8px 0 0",
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  takeRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    padding: "6px 8px",
    borderRadius: 6,
    border: "1px solid #e2e2e2",
    background: "#fff",
  },
  takeRowSelected: {
    border: "1px solid #4caf50",
    background: "#f1faf1",
  },
  takeRadioLabel: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 13,
    minWidth: 70,
  },
  audio: {
    height: 32,
    maxWidth: 260,
  },
  takeMeta: {
    fontSize: 11,
    color: "#777",
  },
};
