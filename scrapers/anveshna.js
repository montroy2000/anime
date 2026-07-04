const axios = require('axios');
const Config = require('../utils/config');
const { CustomError } = require('../middleware/errorHandler');

class Anveshna {
    constructor() {
        this.defaultPerPage = 20;
    }

    get baseUrl() {
        return Config.baseUrl.replace(/\/+$/, '');
    }

    async fetchAdvancedSearch(query = '', page = 1, perPage = this.defaultPerPage, options = {}) {
        const url = `${this.baseUrl}/meta/anilist/advanced-search`;

        try {
            const response = await axios.get(url, {
                timeout: Config.requestTimeout,
                params: {
                    ...(query ? { query } : {}),
                    page,
                    perPage,
                    type: options.type || 'ANIME',
                    ...(options.sort ? { sort: JSON.stringify(options.sort) } : {})
                },
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': Config.userAgent
                }
            });

            return this.toAnimepaheApiShape(response.data);
        } catch (error) {
            const status = error.response?.status || 503;
            const message = error.response?.data?.message || error.message || 'Failed to fetch Anveshna data';
            throw new CustomError(`Anveshna request failed: ${message}`, status);
        }
    }

    async fetchSearchData(query, page = 1) {
        return this.fetchAdvancedSearch(query, page);
    }

    async fetchAiringData(page = 1) {
        return this.fetchAdvancedSearch('', page, this.defaultPerPage, {
            sort: ['POPULARITY_DESC']
        });
    }

    toAnimepaheApiShape(payload) {
        const results = Array.isArray(payload?.results) ? payload.results : [];

        return {
            total: payload?.totalResults,
            per_page: results.length || this.defaultPerPage,
            current_page: payload?.currentPage,
            last_page: payload?.totalPages,
            data: results.map(item => this.toAnimepaheItem(item))
        };
    }

    toAnimepaheItem(item) {
        const title = item?.title?.english || item?.title?.romaji || item?.title?.userPreferred || item?.title?.native || null;

        return {
            id: item?.id || null,
            title,
            status: item?.status || null,
            type: item?.type || null,
            episodes: item?.totalEpisodes || item?.currentEpisode || null,
            score: item?.rating || null,
            year: item?.releaseDate || null,
            season: null,
            poster: item?.image || null,
            session: item?.id ? String(item.id) : null,
            source: 'anveshna',
            malId: item?.malId || null,
            genres: item?.genres || [],
            description: item?.description || null,
            cover: item?.cover || null
        };
    }
}

module.exports = new Anveshna();
