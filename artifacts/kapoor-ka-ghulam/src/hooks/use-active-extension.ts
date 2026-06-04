import { useGetSettings, useGetExtensions } from "@workspace/api-client-react";

export function useActiveExtension() {
  const { data: settings, isLoading: isLoadingSettings } = useGetSettings();
  const { data: extensions, isLoading: isLoadingExtensions } = useGetExtensions();

  const activeExtId = settings?.activeExtId ?? null;
  const activeExtension = extensions?.find((e) => e.id === activeExtId) ?? null;

  return {
    activeExtId,
    activeExtension,
    isLoading: isLoadingSettings || isLoadingExtensions,
  };
}
