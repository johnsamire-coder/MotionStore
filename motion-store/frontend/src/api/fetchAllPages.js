import axiosClient from './axiosClient';

export async function fetchAllPages(url, params = {}) {
  const items = [];
  let page = 1;

  while (true) {
    const { data } = await axiosClient.get(url, {
      params: { ...params, page },
    });

    const rows = Array.isArray(data) ? data : data?.results;
    if (!Array.isArray(rows)) {
      throw new Error(`Unexpected list response from ${url}`);
    }

    items.push(...rows);
    if (Array.isArray(data) || !data.next) return items;

    const nextPage = Number(
      new URL(data.next, window.location.origin).searchParams.get('page')
    );
    if (!Number.isInteger(nextPage) || nextPage <= page) {
      throw new Error(`Invalid pagination response from ${url}`);
    }
    page = nextPage;
  }
}
