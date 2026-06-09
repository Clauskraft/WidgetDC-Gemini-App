import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/gems")({
  component: WidgetsLayout,
});

function WidgetsLayout() {
  return <Outlet />;
}
