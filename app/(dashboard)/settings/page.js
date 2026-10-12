"use client";

import EmailSettings from "@/components/meter/EmailSettings";
import PageHeader from "@/components/PageHeader";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Where and whether alert emails are sent" />
      <EmailSettings />
    </>
  );
}
