export function openNews(newsId: number) {
    window.dispatchEvent(new CustomEvent('open-news', { detail: { newsId } }))
}
