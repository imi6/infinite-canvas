import localforage from "localforage";
import { create } from "zustand";

import { fetchSiteModelCatalog } from "@/services/api/site-model-catalog";
import { applySiteModelCatalog, normalizeChannelModels, useConfigStore, type ChannelModel } from "@/stores/use-config-store";

type CatalogCache = { models: ChannelModel[]; syncedAt: string };
type SiteModelCatalogStore = CatalogCache & {
    loading: boolean;
    error: string;
    initialize: () => Promise<void>;
    refresh: () => Promise<ChannelModel[]>;
    applyToConfig: () => void;
};

const cache = localforage.createInstance({ name: "infinite-canvas", storeName: "site_model_catalog" });
let initialization: Promise<void> | undefined;
let refreshing: Promise<ChannelModel[]> | undefined;

function validCache(value: unknown): value is CatalogCache {
    const item = value as CatalogCache | null;
    return Boolean(item && typeof item.syncedAt === "string" && Number.isFinite(Date.parse(item.syncedAt)) && Array.isArray(item.models) && item.models.length && item.models.every((model) =>
        model && typeof model.name === "string" && model.name.trim() && ["image", "video", "text", "audio"].includes(model.capability),
    ));
}

export const useSiteModelCatalogStore = create<SiteModelCatalogStore>((set, get) => ({
    models: [],
    syncedAt: "",
    loading: false,
    error: "",
    applyToConfig: () => {
        const current = useConfigStore.getState().config;
        const config = applySiteModelCatalog(current, get().models, get().syncedAt);
        if (config !== current) useConfigStore.setState({ config });
    },
    initialize: () => {
        if (!initialization) initialization = (async () => {
            try {
                const saved = await cache.getItem<unknown>("catalog");
                if (validCache(saved) && !get().models.length) {
                    set({ models: normalizeChannelModels(saved.models), syncedAt: saved.syncedAt });
                    get().applyToConfig();
                }
            } catch {
                // 缓存不可读时继续请求公开目录，不清空用户已有配置。
            }
            await get().refresh().catch(() => undefined);
        })();
        return initialization;
    },
    refresh: () => {
        if (!refreshing) {
            set({ loading: true, error: "" });
            refreshing = (async () => {
                try {
                    const models = await fetchSiteModelCatalog();
                    const snapshot = { models, syncedAt: new Date().toISOString() };
                    set(snapshot);
                    get().applyToConfig();
                    try {
                        await cache.setItem("catalog", snapshot);
                    } catch {
                        set({ error: "模型目录已同步，但浏览器未能保存缓存" });
                    }
                    return models;
                } catch (error) {
                    set({ error: error instanceof Error ? error.message : "读取本站模型目录失败" });
                    throw error;
                } finally {
                    set({ loading: false });
                    refreshing = undefined;
                }
            })();
        }
        return refreshing;
    },
}));
