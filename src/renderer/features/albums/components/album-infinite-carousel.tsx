import { QueryFunctionContext, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { Suspense, useCallback, useMemo } from 'react';

import { api } from '/@/renderer/api';
import { queryKeys } from '/@/renderer/api/query-keys';
import {
    GridCarousel,
    GridCarouselSkeletonFallback,
    useGridCarouselContainerQuery,
} from '/@/renderer/components/grid-carousel/grid-carousel-v2';
import { DataRow, MemoizedItemCard } from '/@/renderer/components/item-card/item-card';
import { useDefaultItemListControls } from '/@/renderer/components/item-list/helpers/item-list-controls';
import { useGridRows } from '/@/renderer/components/item-list/helpers/use-grid-rows';
import { useCurrentServerId } from '/@/renderer/store';
import {
    Album,
    AlbumListQuery,
    AlbumListResponse,
    AlbumListSort,
    LibraryItem,
    SortOrder,
} from '/@/shared/types/domain-types';
import { ItemListKey } from '/@/shared/types/types';

interface AlbumCarouselProps {
    containerQuery?: ReturnType<typeof useGridCarouselContainerQuery>;
    deprioritizeSingles?: boolean;
    enableRefresh?: boolean;
    excludeIds?: string[];
    // Hide albums whose lastPlayedAt falls within the given number of days.
    // Not supported by all servers (album play dates require Navidrome).
    excludeRecentDays?: number;
    query?: Partial<Omit<AlbumListQuery, 'startIndex'>>;
    queryKey?: QueryFunctionContext['queryKey'];
    rowCount?: number;
    sortBy: AlbumListSort;
    sortOrder: SortOrder;
    title: React.ReactNode | string;
}

const isSingleAlbum = (album: Album) => {
    const types = [
        ...(album.releaseTypes ?? []),
        ...(album.releaseType ? [album.releaseType] : []),
    ];

    if (types.some((type) => type.toLowerCase().includes('single'))) {
        return true;
    }

    // Fallback for albums without release tags: singles usually have 1-2 tracks
    return album.songCount != null && album.songCount <= 2;
};

const BaseAlbumInfiniteCarousel = (props: AlbumCarouselProps & { rows: DataRow[] }) => {
    const {
        containerQuery,
        deprioritizeSingles,
        enableRefresh,
        excludeIds,
        excludeRecentDays,
        query: additionalQuery,
        queryKey,
        rowCount = 1,
        rows,
        sortBy,
        sortOrder,
        title,
    } = props;
    const {
        data: albums,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        refetch,
    } = useAlbumListInfinite(sortBy, sortOrder, 20, additionalQuery, queryKey);

    const controls = useDefaultItemListControls();

    const cards = useMemo(() => {
        const allItems = albums?.pages.flatMap((page: AlbumListResponse) => page.items) || [];

        // eslint-disable-next-line react-hooks/purity
        const minLastPlayed = excludeRecentDays ? Date.now() - excludeRecentDays * 86400000 : null;

        let items = allItems.filter((album) => {
            if (excludeIds?.includes(album.id)) {
                return false;
            }

            if (
                minLastPlayed &&
                album.lastPlayedAt &&
                Date.parse(album.lastPlayedAt) > minLastPlayed
            ) {
                return false;
            }

            return true;
        });

        if (deprioritizeSingles) {
            items = items
                .filter((album) => !isSingleAlbum(album))
                .concat(items.filter(isSingleAlbum));
        }

        return items.map((album: Album) => ({
            content: (
                <MemoizedItemCard
                    controls={controls}
                    data={album}
                    enableDrag
                    enableExpansion
                    imageFetchPriority="low"
                    itemType={LibraryItem.ALBUM}
                    rows={rows}
                    type="poster"
                    withControls
                />
            ),
            id: album.id,
        }));
    }, [albums, controls, excludeIds, excludeRecentDays, deprioritizeSingles, rows]);

    const handleNextPage = useCallback(() => {}, []);

    const handlePrevPage = useCallback(() => {}, []);

    const handleRefresh = useCallback(() => {
        refetch();
    }, [refetch]);

    // Gate on the raw page size, ignoring client-side filtering, so the carousel
    // is only hidden when the server has no visible albums at all
    if ((albums?.pages[0]?.items.length || 0) === 0) {
        return null;
    }

    return (
        <GridCarousel
            cards={cards}
            containerQuery={containerQuery}
            enableRefresh={enableRefresh}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            loadNextPage={fetchNextPage}
            onNextPage={handleNextPage}
            onPrevPage={handlePrevPage}
            onRefresh={handleRefresh}
            placeholderItemType={LibraryItem.ALBUM}
            placeholderRows={rows}
            rowCount={rowCount}
            title={title}
        />
    );
};

export const AlbumInfiniteCarousel = (props: AlbumCarouselProps) => {
    const rows = useGridRows(LibraryItem.ALBUM, ItemListKey.ALBUM);

    return (
        <Suspense
            fallback={
                <GridCarouselSkeletonFallback
                    containerQuery={props.containerQuery}
                    placeholderItemType={LibraryItem.ALBUM}
                    placeholderRows={rows}
                    title={props.title}
                />
            }
        >
            <BaseAlbumInfiniteCarousel {...props} rows={rows} />
        </Suspense>
    );
};

function useAlbumListInfinite(
    sortBy: AlbumListSort,
    sortOrder: SortOrder,
    itemLimit: number,
    additionalQuery?: Partial<Omit<AlbumListQuery, 'startIndex'>>,
    overrideQueryKey?: QueryFunctionContext['queryKey'],
) {
    const serverId = useCurrentServerId();

    const defaultQueryKey = queryKeys.albums.infiniteList(serverId, {
        sortBy,
        sortOrder,
        ...additionalQuery,
    });

    const query = useSuspenseInfiniteQuery<AlbumListResponse>({
        getNextPageParam: (lastPage, _allPages, lastPageParam) => {
            if (lastPage.items.length < itemLimit) {
                return undefined;
            }

            const nextPageParam = Number(lastPageParam) + itemLimit;

            return String(nextPageParam);
        },
        initialPageParam: '0',
        queryFn: ({ pageParam, signal }) => {
            return api.controller.getAlbumList({
                apiClientProps: { serverId, signal },
                query: {
                    limit: itemLimit,
                    sortBy,
                    sortOrder,
                    startIndex: Number(pageParam),
                    ...additionalQuery,
                },
            });
        },
        queryKey: overrideQueryKey || defaultQueryKey,
    });

    return query;
}
