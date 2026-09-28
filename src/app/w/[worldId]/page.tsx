export default async function WorldDeepLink({
  params,
}: {
  params: Promise<{ worldId: string }>;
}) {
  const { worldId } = await params;
  void worldId;
  return null;
}
