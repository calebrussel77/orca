const ALLOWED_BROWSER_GUEST_PERMISSIONS = new Set(['fullscreen', 'clipboard-sanitized-write'])

export function isAllowedBrowserGuestPermission(permission: string): boolean {
  // Why: Chromium routes normal "copy selected text" through the sanitized
  // clipboard-write permission. Allowing only this narrow write capability keeps
  // in-app browser tabs copyable without opening broader desktop permissions
  // like clipboard-read, camera, microphone, notifications, or screen capture.
  return ALLOWED_BROWSER_GUEST_PERMISSIONS.has(permission)
}
