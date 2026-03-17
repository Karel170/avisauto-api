export interface ApifyReview {
  reviewId?: string;
  name?: string;
  text?: string;
  textTranslated?: string;
  stars?: number;
  rating?: number;
  publishedAtDate?: string;
  publishAt?: string;
  responseFromOwnerText?: string;
  reviewerNumberOfReviews?: number;
  isLocalGuide?: boolean;
}

export async function fetchApifyReviews(datasetUrl: string): Promise<ApifyReview[]> {
  const url = datasetUrl.includes("?")
    ? datasetUrl
    : `${datasetUrl}?format=json&clean=true`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Apify fetch failed: ${response.statusText}`);
  }

  const data = await response.json() as ApifyReview[];
  return Array.isArray(data) ? data : [];
}
