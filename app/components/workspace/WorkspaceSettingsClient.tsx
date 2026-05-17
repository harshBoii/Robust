'use client';

export default function WorkspaceSettingsClient() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Workspace settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Account and workspace preferences.
        </p>
      </div>

      <div className="glass-card p-4">
        <h3 className="text-lg font-semibold">Coming soon</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Additional workspace settings will appear here. Use Manager for automation rules and Meta
          connection.
        </p>
      </div>
    </div>
  );
}
