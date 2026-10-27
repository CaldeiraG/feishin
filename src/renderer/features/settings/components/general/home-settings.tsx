import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { DraggableItems } from '/@/renderer/features/settings/components/general/draggable-items';
import { SettingsOptions } from '/@/renderer/features/settings/components/settings-option';
import {
    HomeItem,
    SortableItem,
    useGeneralSettings,
    useSettingsStoreActions,
} from '/@/renderer/store';
import { NumberInput } from '/@/shared/components/number-input/number-input';

const HOME_ITEMS: Array<[string, string]> = [
    [HomeItem.GENRES, 'page.home.genres'],
    [HomeItem.RANDOM, 'page.home.explore'],
    [HomeItem.REDISCOVER, 'page.home.rediscover'],
    [HomeItem.PLAYLISTS, 'page.home.playlists'],
    [HomeItem.RECENTLY_PLAYED, 'page.home.recentlyPlayed'],
    [HomeItem.RECENTLY_ADDED, 'page.home.newlyAdded'],
    [HomeItem.RECENTLY_RELEASED, 'page.home.recentlyReleased'],
    [HomeItem.MOST_PLAYED, 'page.home.mostPlayed'],
];

export const HomeSettings = memo(() => {
    const { t } = useTranslation();
    const { homeItems, rediscoverDays } = useGeneralSettings();
    const { setHomeItems, setSettings } = useSettingsStoreActions();

    return (
        <>
            <DraggableItems
                description="setting.homeConfiguration"
                itemLabels={HOME_ITEMS}
                items={homeItems as SortableItem<HomeItem>[]}
                setItems={setHomeItems}
                title="setting.homeConfiguration"
            />
            <SettingsOptions
                control={
                    <NumberInput
                        defaultValue={rediscoverDays}
                        max={3650}
                        min={0}
                        onBlur={(e) => {
                            const raw = e.currentTarget.value.trim();
                            const value = Number(raw);

                            if (raw === '' || Number.isNaN(value) || value === rediscoverDays)
                                return;

                            setSettings({ general: { rediscoverDays: value } });
                        }}
                        step={1}
                        width={100}
                    />
                }
                title={t('setting.rediscoverDays')}
            />
        </>
    );
});
