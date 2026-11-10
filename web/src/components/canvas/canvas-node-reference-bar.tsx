import { FileText, Image as ImageIcon, Link2, Music2, Plus, Puzzle, Video, X } from "lucide-react";
import { App, Button, Input, Modal, Popover, Segmented } from "antd";
import { useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";

import { canvasThemes } from "@/lib/canvas-theme";
import { getNodeDefinition } from "@/lib/canvas/node-registry";
import { getGroupResourceNodes } from "@/lib/canvas/canvas-resource-references";
import { getImagePreviewRevision, previewUrlFor, subscribeImagePreviews } from "@/services/image-storage";
import { useThemeStore } from "@/stores/use-theme-store";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";

export type CanvasReferenceLinkHandler = (nodeId: string, type: CanvasNodeType.Image | CanvasNodeType.Video | CanvasNodeType.Audio, urls: string[]) => Promise<void>;

export function CanvasNodeReferenceBar({ nodeId, nodes, connectedNodes, onDisconnect, onStartSelection, onAddLinks }: { nodeId: string; nodes: CanvasNodeData[]; connectedNodes: CanvasNodeData[]; onDisconnect?: (fromNodeId: string, toNodeId: string) => void; onStartSelection?: (nodeId: string) => void; onAddLinks?: CanvasReferenceLinkHandler }) {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const [linkOpen, setLinkOpen] = useState(false);
    const [linkType, setLinkType] = useState<CanvasNodeType.Image | CanvasNodeType.Video | CanvasNodeType.Audio>(CanvasNodeType.Image);
    const [links, setLinks] = useState("");
    const [adding, setAdding] = useState(false);
    const references = connectedNodes.flatMap((sourceNode) => (sourceNode.type === CanvasNodeType.Group ? getGroupResourceNodes(sourceNode.id, nodes) : [sourceNode]).map((node) => ({ node, sourceNodeId: sourceNode.id })));

    const addLinks = async () => {
        if (adding || !onAddLinks) return;
        const urls = [...new Set(links.split(/\r?\n/).map((url) => url.trim()).filter(Boolean))];
        if (!urls.length || urls.some((url) => {
            try { return !["https:", "http:"].includes(new URL(url).protocol); }
            catch { return true; }
        })) {
            message.error(t("videoWorkbench.invalidReferenceLinks"));
            return;
        }
        setAdding(true);
        try {
            await onAddLinks(nodeId, linkType, urls);
            setLinkOpen(false);
            setLinks("");
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("canvas.sidePanel.addFailed"));
        } finally {
            setAdding(false);
        }
    };

    return (
        <div className="mb-2">
            <div className="mb-1.5 flex items-center justify-between gap-2" style={{ color: theme.node.muted }}>
                <span className="text-[11px] font-medium">{t("canvas.references.title")}</span>
                {onAddLinks ? <Button type="text" size="small" className="!h-6 !bg-transparent !px-1.5 !text-[11px]" style={{ color: theme.node.muted }} icon={<Link2 className="size-3" />} onClick={() => setLinkOpen(true)}>{t("videoWorkbench.addLink")}</Button> : null}
            </div>
            <div className="thin-scrollbar flex min-h-12 gap-2 overflow-x-auto pb-1">
                {references.map(({ node, sourceNodeId }) => <ReferenceItem key={`${sourceNodeId}:${node.id}`} node={node} onRemove={() => onDisconnect?.(sourceNodeId, nodeId)} />)}
                <button type="button" className="grid size-12 shrink-0 place-items-center rounded-xl border bg-transparent transition hover:opacity-70" style={{ borderColor: theme.toolbar.border, color: theme.node.muted }} title={t("canvas.references.select")} onClick={() => onStartSelection?.(nodeId)}>
                    <Plus className="size-4" />
                </button>
            </div>
            <Modal title={t("canvas.references.addLinks")} open={linkOpen} onCancel={() => setLinkOpen(false)} onOk={() => void addLinks()} okText={t("common.add")} confirmLoading={adding} cancelButtonProps={{ disabled: adding }} closable={!adding} maskClosable={!adding} keyboard={!adding} modalRender={(content) => <div data-canvas-shortcuts-ignore>{content}</div>} centered>
                <div data-canvas-no-zoom className="space-y-4 py-2" onPointerDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
                    <Segmented<CanvasNodeType.Image | CanvasNodeType.Video | CanvasNodeType.Audio> block value={linkType} disabled={adding} onChange={setLinkType} options={[
                        { value: CanvasNodeType.Image, icon: <ImageIcon className="inline size-3.5" />, label: t("canvas.nodeTypes.image") },
                        { value: CanvasNodeType.Video, icon: <Video className="inline size-3.5" />, label: t("canvas.nodeTypes.video") },
                        { value: CanvasNodeType.Audio, icon: <Music2 className="inline size-3.5" />, label: t("canvas.nodeTypes.audio") },
                    ]} />
                    <Input.TextArea value={links} onChange={(event) => setLinks(event.target.value)} rows={5} placeholder={t("canvas.references.linksPlaceholder")} aria-label={t("canvas.references.addLinks")} disabled={adding} />
                    <p className="text-xs leading-relaxed" style={{ color: theme.node.muted }}>{t("canvas.references.linksHint")}</p>
                </div>
            </Modal>
        </div>
    );
}

function ReferenceItem({ node, onRemove }: { node: CanvasNodeData; onRemove: () => void }) {
    const { t } = useTranslation();
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    useSyncExternalStore(subscribeImagePreviews, getImagePreviewRevision);
    const resource = getNodeDefinition(node.type)?.resource?.(node);
    const content = node.metadata?.content || resource?.url;
    const thumbnail = previewUrlFor(node.metadata?.storageKey) || content;
    const Icon = resource?.kind === "image" || node.type === CanvasNodeType.Image ? ImageIcon : resource?.kind === "video" || node.type === CanvasNodeType.Video ? Video : resource?.kind === "audio" || node.type === CanvasNodeType.Audio ? Music2 : resource?.kind === "text" || node.type === CanvasNodeType.Text ? FileText : Puzzle;
    return (
        <Popover placement="topLeft" mouseEnterDelay={0.15} content={<ReferencePreview node={node} content={content} />}>
            <div className="group relative grid size-12 shrink-0 place-items-center rounded-xl border" style={{ background: theme.toolbar.activeBg, borderColor: theme.toolbar.border }}>
                <span className="grid size-full place-items-center overflow-hidden rounded-[inherit]">
                    {(resource?.kind === "image" || node.type === CanvasNodeType.Image) && thumbnail ? <img src={thumbnail} alt="" className="size-full object-cover" /> : (resource?.kind === "video" || node.type === CanvasNodeType.Video) && content ? <video src={content} className="size-full object-cover" muted /> : <Icon className="size-4 opacity-65" />}
                </span>
                <button type="button" className="absolute right-0 top-0 grid size-5 place-items-center rounded-full border opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100" style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border }} aria-label={t("canvas.references.disconnect")} title={t("canvas.references.disconnect")} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onRemove(); }}><X className="size-3" /></button>
            </div>
        </Popover>
    );
}

function ReferencePreview({ node, content }: { node: CanvasNodeData; content?: string }) {
    const { t } = useTranslation();
    const resource = getNodeDefinition(node.type)?.resource?.(node);
    if ((resource?.kind === "image" || node.type === CanvasNodeType.Image) && content) return <img src={content} alt={node.title} className="max-h-52 w-72 rounded-lg object-contain" />;
    if ((resource?.kind === "video" || node.type === CanvasNodeType.Video) && content) return <video src={content} className="max-h-52 w-72 rounded-lg" muted controls />;
    if ((resource?.kind === "audio" || node.type === CanvasNodeType.Audio) && content) return <audio src={content} className="w-72" controls />;
    return <div className="max-h-52 w-72 overflow-auto whitespace-pre-wrap text-sm">{resource?.text || node.metadata?.content || node.metadata?.prompt || node.title || t("canvas.references.empty")}</div>;
}
