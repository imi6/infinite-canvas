import { Button, Checkbox, Modal, theme } from "antd";
import { CircleAlert, Clock3, Download, Expand, LockKeyhole, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

type WorkbenchKind = "image" | "video";
const noticeSnoozeKey = (kind: WorkbenchKind) => `infinite-canvas:${kind}_creation_notice:v1`;
const SNOOZE_DURATION = 7 * 24 * 60 * 60 * 1000;
const noticeItems = [
    { key: "safety", icon: ShieldCheck },
    { key: "saving", icon: Download },
    { key: "limits", icon: Expand },
    { key: "privacy", icon: LockKeyhole },
    { key: "submission", icon: Clock3 },
] as const;

export function isCreationNoticeSnoozed(kind: WorkbenchKind) {
    try {
        const until = Number(localStorage.getItem(noticeSnoozeKey(kind)));
        return Number.isFinite(until) && until > Date.now();
    } catch {
        return false;
    }
}

export function WorkbenchCreationNotice({ kind, open, onContinue, onCancel }: { kind: WorkbenchKind; open: boolean; onContinue: () => void; onCancel: () => void }) {
    const { t } = useTranslation();
    const { token } = theme.useToken();
    const [snooze, setSnooze] = useState(() => isCreationNoticeSnoozed(kind));
    const prefix = kind === "image" ? "imageWorkbench.notice" : "videoWorkbench.notice";

    const accept = () => {
        try {
            if (snooze) localStorage.setItem(noticeSnoozeKey(kind), String(Date.now() + SNOOZE_DURATION));
            else localStorage.removeItem(noticeSnoozeKey(kind));
        } catch {
            // 浏览器禁用存储时仅确认本次，后续进入仍会提示。
        }
        onContinue();
    };

    return (
        <Modal
            open={open}
            centered
            width={900}
            closable={false}
            keyboard={false}
            mask={{ closable: false }}
            classNames={{ body: "thin-scrollbar" }}
            styles={{
                container: { display: "flex", flexDirection: "column", maxHeight: "calc(100dvh - 32px)", overflow: "hidden", padding: 0, borderRadius: 16 },
                header: { flexShrink: 0, margin: 0, padding: "22px 24px", borderBottom: `1px solid ${token.colorBorderSecondary}` },
                body: { minHeight: 0, overflowY: "auto", padding: "16px 24px 20px", background: token.colorBgLayout },
                footer: { flexShrink: 0, margin: 0, padding: "16px 24px", borderTop: `1px solid ${token.colorBorderSecondary}` },
            }}
            title={
                <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full border" style={{ borderColor: token.colorBorder, background: token.colorFillQuaternary }}>
                        <CircleAlert className="size-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 pt-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-lg font-semibold tracking-tight">{t(`${prefix}.title`)}</span>
                            <span className="rounded px-2 py-0.5 text-xs font-medium" style={{ color: token.colorTextSecondary, background: token.colorFillSecondary }}>{t(`${prefix}.badge`)}</span>
                        </div>
                        <p className="mt-2 text-xs font-normal leading-relaxed" style={{ color: token.colorTextSecondary }}>{t(`${prefix}.description`)}</p>
                    </div>
                </div>
            }
            footer={
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <Checkbox checked={snooze} onChange={(event) => setSnooze(event.target.checked)}>{t(`${prefix}.snooze`)}</Checkbox>
                    <div className="grid grid-cols-[auto_1fr] gap-2 sm:flex">
                        <Button onClick={onCancel}>{t(`${prefix}.later`)}</Button>
                        <Button type="primary" onClick={accept}>{t(`${prefix}.continue`)}</Button>
                    </div>
                </div>
            }
        >
            <ol className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
                {noticeItems.map(({ key, icon: Icon }) => (
                    <li key={key} className={`flex items-start gap-3 rounded-2xl border p-3.5 sm:p-4 ${key === "submission" ? "sm:col-span-2" : ""}`} style={{ borderColor: token.colorBorderSecondary, background: token.colorBgContainer }}>
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ color: token.colorTextSecondary, background: token.colorFillSecondary }}>
                            <Icon className="size-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                            <h3 className="mb-1.5 text-sm font-semibold">{t(`${prefix}.items.${key}.title`)}</h3>
                            <p className="text-xs leading-5" style={{ color: token.colorTextSecondary }}>{t(`${prefix}.items.${key}.body`)}</p>
                            {kind === "video" && key === "submission" ? <p className="mt-1 text-xs leading-5" style={{ color: token.colorTextSecondary }}>{t("videoWorkbench.notice.items.submission.extra")}</p> : null}
                        </div>
                    </li>
                ))}
            </ol>
            <p className="mt-3 text-xs leading-5" style={{ color: token.colorTextTertiary }}>{t(`${prefix}.agreement`)}</p>
        </Modal>
    );
}
