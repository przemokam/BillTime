import { getWeekdayDefaults, getSetting } from "@/lib/queries";
import { SettingsManager } from "@/components/settings/SettingsManager";

export default async function SettingsPage() {
  const [rules, defaultCurrency] = await Promise.all([getWeekdayDefaults(), getSetting("defaultCurrency")]);
  const weekday: Record<number, string> = {};
  for (const r of rules) if (r.enabled) weekday[r.weekday] = r.description;
  return <SettingsManager weekday={weekday} defaultCurrency={defaultCurrency ?? "EUR"} />;
}
