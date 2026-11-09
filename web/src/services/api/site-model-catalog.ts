import axios from "axios";

import { withLocalProxy, type ChannelModel, type ModelCapability } from "@/stores/use-config-store";

type CatalogModel = { model: ChannelModel; priority: number };

const recordOf = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

function classifyModel(name: string, group: Record<string, unknown>, pricing: Record<string, unknown> | null): CatalogModel | null {
    if (/embed|rerank|re-rank|嵌入|重排/i.test(name)) return null;
    const billing = pricing?.billing_mode;
    if (billing === "image" || billing === "video" || billing === "text" || billing === "audio") {
        return { model: { name, capability: billing }, priority: 3 };
    }
    // 按次或按 token 计费不代表模型能力，先依据目录分组和模型描述判断。
    const descriptions: Array<[ModelCapability, RegExp]> = [
        ["video", /video|视频/i],
        ["image", /image|生图|图像|绘图/i],
        ["audio", /audio|tts|speech|语音|音频|音乐/i],
        ["text", /text|chat|completion|文本|对话|聊天|语言模型/i],
    ];
    for (const source of [name, group.name, group.description]) {
        if (typeof source !== "string") continue;
        const capability = descriptions.find(([, pattern]) => pattern.test(source))?.[0];
        if (capability) return { model: { name, capability }, priority: 2 };
    }
    if (billing === "token") return { model: { name, capability: "text" }, priority: 1 };
    return null;
}

export async function fetchSiteModelCatalog(): Promise<ChannelModel[]> {
    const response = await axios.get<unknown>(withLocalProxy("https://sub.zzshu.cc/api/v1/model-plaza"));
    const payload = recordOf(response.data);
    const data = recordOf(payload?.data);
    if (payload?.code !== 0 || !Array.isArray(data?.groups)) throw new Error("本站模型目录返回格式无效");
    const models = new Map<string, CatalogModel>();
    for (const entry of data.groups) {
        const group = recordOf(entry);
        if (!group || !Array.isArray(group.models)) throw new Error("本站模型目录分组格式无效");
        for (const item of group.models) {
            const model = recordOf(item);
            if (!model || typeof model.name !== "string" || !model.name.trim()) throw new Error("本站模型目录缺少有效模型名称");
            const candidate = classifyModel(model.name.trim(), group, recordOf(model.pricing));
            if (candidate && candidate.priority > (models.get(candidate.model.name)?.priority ?? 0)) models.set(candidate.model.name, candidate);
        }
    }
    if (!models.size) throw new Error("本站模型目录未返回可用于创作的模型");
    return Array.from(models.values(), ({ model }) => model);
}
