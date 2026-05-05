export const PROFILE_REFRESH_EVENT = "examarchive:profile-refresh";

export function dispatchProfileRefreshEvent(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PROFILE_REFRESH_EVENT));
}
