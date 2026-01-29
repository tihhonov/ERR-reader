import { useState, useEffect } from 'react'
import './App.css'

interface Article {
    guid: string
    title: string
    link: string
    description: string
    pubDate: string
    category: string
    imageUrl: string
}

type Language = 'et' | 'ru' | 'en'

interface Translations {
    title: string
    subtitle: string
    loading: string
    error: string
    updated: string
    newsLastHour: string
    compactView: string
    unread: string
    noNews: string
    justNow: string
    minutesAgo: (n: number) => string
    hoursAgo: (n: number) => string
}

const translations: Record<Language, Translations> = {
    et: {
        title: 'ERR Uudised',
        subtitle: 'Jälgi Eesti viimaseid uudiseid reaalajas',
        loading: 'Uudiste laadimine...',
        error: 'Uudiste laadimine ebaõnnestus. Palun proovi hiljem uuesti.',
        updated: 'Uuendatud',
        newsLastHour: 'uudist viimase tunni jooksul',
        compactView: 'Compact view',
        unread: 'Lugemata',
        noNews: 'Uudiseid pole veel',
        justNow: 'just nüüd',
        minutesAgo: (n: number) => `${n} min tagasi`,
        hoursAgo: (n: number) => `${n} h tagasi`
    },
    ru: {
        title: 'ERR Новости',
        subtitle: 'Следите за новостями в режиме реального времени',
        loading: 'Загрузка новостей...',
        error: 'Не удалось загрузить новости. Попробуйте позже.',
        updated: 'Обновлено',
        newsLastHour: 'новостей за последний час',
        compactView: 'Compact view',
        unread: 'Unread',
        noNews: 'Новостей пока нет',
        justNow: 'только что',
        minutesAgo: (n: number) => `${n} мин назад`,
        hoursAgo: (n: number) => `${n} ч назад`
    },
    en: {
        title: 'ERR News',
        subtitle: 'Follow the latest Estonian news in real-time',
        loading: 'Loading news...',
        error: 'Failed to load news. Please try again later.',
        updated: 'Updated',
        newsLastHour: 'news in the last hour',
        compactView: 'Compact view',
        unread: 'Unread',
        noNews: 'No news yet',
        justNow: 'just now',
        minutesAgo: (n: number) => `${n} min ago`,
        hoursAgo: (n: number) => `${n} h ago`
    }
}

const RSS_URLS: Record<Language, string> = {
    et: 'https://www.err.ee/rss',
    ru: 'https://rus.err.ee/rss',
    en: 'https://news.err.ee/rss'
}

const CORS_PROXY = 'https://corsproxy.io/?'
const REFRESH_INTERVAL = 60000 // 60 seconds
const READ_ARTICLES_KEY = 'err-news-read-articles'
const LANGUAGE_KEY = 'err-news-language'

function App() {
    const [articles, setArticles] = useState<Article[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
    const [readArticles, setReadArticles] = useState<Set<string>>(new Set())
    const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set())
    const [isCompactView, setIsCompactView] = useState(false)
    const [language, setLanguage] = useState<Language>('ru')

    // Load language from localStorage
    useEffect(() => {
        const storedLang = localStorage.getItem(LANGUAGE_KEY)
        if (storedLang === 'et' || storedLang === 'ru' || storedLang === 'en') {
            setLanguage(storedLang)
        }
    }, [])

    // Load read articles from localStorage
    useEffect(() => {
        const stored = localStorage.getItem(READ_ARTICLES_KEY)
        if (stored) {
            try {
                const parsed = JSON.parse(stored)
                setReadArticles(new Set(parsed))
            } catch (e) {
                console.error('Failed to parse read articles:', e)
            }
        }
    }, [])

    // Save read articles to localStorage
    useEffect(() => {
        if (readArticles.size > 0) {
            localStorage.setItem(READ_ARTICLES_KEY, JSON.stringify([...readArticles]))
        }
    }, [readArticles])

    const fetchNews = async (isInitialLoad = false) => {
        try {
            const response = await fetch(`${CORS_PROXY}${RSS_URLS[language]}`)
            if (!response.ok) {
                throw new Error('Failed to fetch news')
            }

            const text = await response.text()
            const parser = new DOMParser()
            const xml = parser.parseFromString(text, 'text/xml')

            const items = xml.querySelectorAll('item')
            const parsedArticles: Article[] = []

            items.forEach((item) => {
                const guid = item.querySelector('guid')?.textContent || ''
                const title = item.querySelector('title')?.textContent || ''
                const link = item.querySelector('link')?.textContent || ''
                const description = item.querySelector('description')?.textContent || ''
                const pubDate = item.querySelector('pubDate')?.textContent || ''
                const category = item.querySelector('category')?.textContent || 'Новости'
                const imageUrl = item.querySelector('thumbnail')?.getAttribute('url') || ''

                if (guid && title) {
                    parsedArticles.push({
                        guid,
                        title,
                        link,
                        description,
                        pubDate,
                        category,
                        imageUrl
                    })
                }
            })

            // On initial load, mark the last 5 articles as read if no read articles exist
            if (isInitialLoad && readArticles.size === 0 && parsedArticles.length > 0) {
                const articlesToMarkAsRead = parsedArticles.slice(0, 5)
                setReadArticles(prev => {
                    const newSet = new Set(prev)
                    articlesToMarkAsRead.forEach(article => {
                        newSet.add(article.guid)
                    })
                    return newSet
                })
            }

            // Extract unique categories and add new ones to active filters
            const currentCategories = [...new Set(parsedArticles.map(a => a.category))]
            setActiveCategories(prev => {
                const newSet = new Set(prev)
                currentCategories.forEach(cat => newSet.add(cat))
                return newSet
            })

            setArticles(parsedArticles)
            setLastUpdated(new Date())
            setError(null)
        } catch (err) {
            console.error('Error fetching news:', err)
            setError('Не удалось загрузить новости. Попробуйте позже.')
        } finally {
            setLoading(false)
        }
    }

    // Initial fetch and refetch when language changes
    useEffect(() => {
        fetchNews(true)
    }, [language])

    // Auto-refresh
    useEffect(() => {
        const interval = setInterval(() => {
            fetchNews()
        }, REFRESH_INTERVAL)

        return () => clearInterval(interval)
    }, [])

    const handleArticleClick = (article: Article) => {
        // Mark as read
        setReadArticles(prev => new Set([...prev, article.guid]))
        // Open link
        window.open(article.link, '_blank', 'noopener,noreferrer')
    }

    const toggleCategory = (category: string) => {
        setActiveCategories(prev => {
            const newSet = new Set(prev)
            if (newSet.has(category)) {
                newSet.delete(category)
            } else {
                newSet.add(category)
            }
            return newSet
        })
    }

    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString)
            const now = new Date()
            const diffMs = now.getTime() - date.getTime()
            const diffMins = Math.floor(diffMs / 60000)
            const diffHours = Math.floor(diffMs / 3600000)

            const t = translations[language]
            if (diffMins < 1) return t.justNow
            if (diffMins < 60) return t.minutesAgo(diffMins)
            if (diffHours < 24) return t.hoursAgo(diffHours)

            const locale = language === 'et' ? 'et-EE' : language === 'ru' ? 'ru-RU' : 'en-US'
            return date.toLocaleDateString(locale, {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            })
        } catch {
            return dateString
        }
    }

    const formatLastUpdated = () => {
        if (!lastUpdated) return ''
        const locale = language === 'et' ? 'et-EE' : language === 'ru' ? 'ru-RU' : 'en-US'
        return lastUpdated.toLocaleTimeString(locale, {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        })
    }

    const getArticlesLastHour = () => {
        const oneHourAgo = new Date(Date.now() - 3600000)
        return articles.filter(article => {
            const articleDate = new Date(article.pubDate)
            return articleDate >= oneHourAgo
        }).length
    }

    // Get all unique categories
    const allCategories = [...new Set(articles.map(a => a.category))].sort()

    // Filter articles by active categories
    const filteredArticles = articles.filter(article =>
        activeCategories.has(article.category)
    )

    // Sort articles by date only (newest first)
    const sortedArticles = [...filteredArticles].sort((a, b) => {
        return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    })

    const t = translations[language]

    const handleLanguageChange = (lang: Language) => {
        setLanguage(lang)
        localStorage.setItem(LANGUAGE_KEY, lang)
        // Clear articles and categories when switching language
        setArticles([])
        setActiveCategories(new Set())
        setLoading(true)
    }

    if (loading) {
        return (
            <div className="app">
                <div className="loading">
                    <div className="loading-spinner"></div>
                    <p className="loading-text">{t.loading}</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="app">
                <div className="error">
                    <div className="error-icon">⚠️</div>
                    <p>{t.error}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="app">
            <header className="header">
                <h1>{t.title}</h1>
                <p>{t.subtitle}</p>

                <div className="stats-container">
                    {lastUpdated && (
                        <div className="stat-badge">
                            <span className="status-dot"></span>
                            <span>{t.updated}: {formatLastUpdated()}</span>
                        </div>
                    )}

                    <div className="stat-badge">
                        <span className="count">{getArticlesLastHour()}</span>
                        <span>{t.newsLastHour}</span>
                    </div>
                </div>

                {allCategories.length > 0 && (
                    <div className="category-filters">
                        {allCategories.map(category => (
                            <button
                                key={category}
                                className={`filter-btn ${activeCategories.has(category) ? 'active' : ''}`}
                                onClick={() => toggleCategory(category)}
                            >
                                {category}
                            </button>
                        ))}
                    </div>
                )}

                <div className="view-toggle">
                    <div className="toggle-group">
                        <button
                            className={`lang-btn ${language === 'et' ? 'active' : ''}`}
                            onClick={() => handleLanguageChange('et')}
                        >
                            Estonian
                        </button>
                        <button
                            className={`lang-btn ${language === 'ru' ? 'active' : ''}`}
                            onClick={() => handleLanguageChange('ru')}
                        >
                            Russian
                        </button>
                        <button
                            className={`lang-btn ${language === 'en' ? 'active' : ''}`}
                            onClick={() => handleLanguageChange('en')}
                        >
                            English
                        </button>
                    </div>

                    <div className="toggle-group">
                        <span className="toggle-label">{t.compactView}</span>
                        <div
                            className={`toggle-switch ${isCompactView ? 'active' : ''}`}
                            onClick={() => setIsCompactView(!isCompactView)}
                        >
                            <div className="toggle-slider"></div>
                        </div>
                    </div>
                </div>
            </header>

            {sortedArticles.length === 0 ? (
                <div className="empty-state">
                    <p>{t.noNews}</p>
                </div>
            ) : (
                <div className={isCompactView ? 'news-list' : 'news-grid'}>
                    {sortedArticles.map((article) => {
                        const isUnread = !readArticles.has(article.guid)

                        return (
                            <article
                                key={article.guid}
                                className={`article-card ${isUnread ? 'unread' : ''} ${isCompactView ? 'compact' : ''}`}
                                onClick={() => handleArticleClick(article)}
                            >
                                {isUnread && <div className="unread-indicator">{t.unread}</div>}
                                {!isUnread && <div className="read-indicator">✓</div>}

                                {!isCompactView && article.imageUrl && (
                                    <img
                                        src={article.imageUrl}
                                        alt={article.title}
                                        className="article-image"
                                        loading="lazy"
                                    />
                                )}

                                <div className="article-content">
                                    <span className="article-category">{article.category}</span>
                                    <h2 className="article-title">{article.title}</h2>
                                    <p className="article-description">{article.description}</p>

                                    <div className="article-meta">
                                        <span className="article-date">
                                            🕐 {formatDate(article.pubDate)}
                                        </span>
                                    </div>
                                </div>
                            </article>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

export default App
