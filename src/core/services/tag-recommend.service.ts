const API_URL = "https://ws.audioscrobbler.com/2.0/";

export async function getArtistsByTag(
  tag: string,
  apiKey: string,
): Promise<string[]> {
  const params = new URLSearchParams({
    method: "tag.gettopartists",
    tag,
    api_key: apiKey,
    format: "json",
    limit: "10",
  });

  const res = await fetch(`${API_URL}?${params}`);
  const data = await res.json();

  return data?.topartists?.artist?.map((a: any) => a.name) ?? [];
}
