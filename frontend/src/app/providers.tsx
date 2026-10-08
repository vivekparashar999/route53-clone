"use client";

import { I18nProvider } from "@cloudscape-design/components/i18n";
import messages from "@cloudscape-design/components/i18n/messages/all.en";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { NotificationsProvider } from "@/components/providers/NotificationsProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider locale="en" messages={[messages]}>
      <ThemeProvider>
        <AuthProvider>
          <NotificationsProvider>{children}</NotificationsProvider>
        </AuthProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}
