/** Static export has no server to render an unknown id. Keep in step with `worlds` in src/worlds/registry.ts. */
const WORLD_ROUTES = ['seaside-house', 'ny-balcony', 'farm'] as const;

export function generateStaticParams() {
  return WORLD_ROUTES.map((worldId) => ({ worldId }));
}

export const dynamicParams = false;

export default async function WorldDeepLink({
  params,
}: {
  params: Promise<{ worldId: string }>;
}) {
  const { worldId } = await params;
  void worldId;
  return null;
}
