import { settingSelector } from 'app/dim-api/selectors';
import { t } from 'app/i18next-t';
import { DimItem } from 'app/inventory/item-types';
import { bucketsSelector } from 'app/inventory/selectors';
import { makeFakeItem } from 'app/inventory/store/d2-item-factory';
import { useD2Definitions } from 'app/manifest/selectors';
import { showNotification } from 'app/notifications/notifications';
import { useThunkDispatch } from 'app/store/thunk-dispatch';
import { WishListRoll } from 'app/wishlists/types';
import { fetchWishList, transformAndStoreWishList } from 'app/wishlists/wishlist-fetch';
import { toWishList } from 'app/wishlists/wishlist-file';
import _ from 'lodash';
import React, { useEffect, useState } from 'react';
import { DropzoneOptions } from 'react-dropzone';
import { useSelector } from 'react-redux';
import { isUri } from 'valid-url';
import FileUpload from '../dim-ui/FileUpload';
import HelpLink from '../dim-ui/HelpLink';
import { clearWishLists } from '../wishlists/actions';
import { wishListsLastFetchedSelector, wishListsSelector } from '../wishlists/selectors';

// config/content-security-policy.js must be edited alongside this list
export const wishListAllowedPrefixes = [
  'https://raw.githubusercontent.com/',
  'https://gist.githubusercontent.com/',
];
export function isValidWishListUrlDomain(url: string) {
  return isUri(url) && wishListAllowedPrefixes.some((p) => url.startsWith(p));
}

const voltronLocation =
  'https://raw.githubusercontent.com/48klocs/dim-wish-list-sources/master/voltron.txt';
const choosyVoltronLocation =
  'https://raw.githubusercontent.com/48klocs/dim-wish-list-sources/master/choosy_voltron.txt';

export default function WishListSettings() {
  const dispatch = useThunkDispatch();
  const wishListSource = useSelector(settingSelector('wishListSource'));
  const voltronNotSelected = wishListSource !== voltronLocation;
  const choosyVoltronNotSelected = wishListSource !== choosyVoltronLocation;
  const wishListLastUpdated = useSelector(wishListsLastFetchedSelector);
  const wishList = useSelector(wishListsSelector).wishListAndInfo;
  const numWishListRolls = wishList.wishListRolls.length;
  const [liveWishListSource, setLiveWishListSource] = useState(wishListSource);
  useEffect(() => {
    dispatch(fetchWishList());
  }, [dispatch]);

  useEffect(() => {
    setLiveWishListSource(wishListSource);
  }, [wishListSource]);

  const [validate, setValidate] = useState<boolean>(false);

  const reloadWishList = async (reloadWishListSource: string | undefined) => {
    try {
      await dispatch(fetchWishList(reloadWishListSource));
      ga('send', 'event', 'WishList', 'From URL');
    } catch (e) {
      showNotification({
        type: 'error',
        title: t('WishListRoll.Header'),
        body: t('WishListRoll.ImportError', { error: e.message }),
      });
    }
  };

  const wishListUpdateEvent = async () => {
    const newWishListSource = liveWishListSource?.trim();

    await reloadWishList(newWishListSource);
  };

  const loadWishList: DropzoneOptions['onDrop'] = (acceptedFiles) => {
    dispatch(clearWishLists());

    const reader = new FileReader();
    reader.onload = async () => {
      if (reader.result && typeof reader.result === 'string') {
        const wishListAndInfo = toWishList(reader.result);
        dispatch(transformAndStoreWishList(wishListAndInfo));
        ga('send', 'event', 'WishList', 'From File');
      }
    };

    const file = acceptedFiles[0];
    if (file) {
      reader.readAsText(file);
    } else {
      alert(t('WishListRoll.ImportNoFile'));
    }
    return false;
  };

  const clearWishListEvent = () => {
    ga('send', 'event', 'WishList', 'Clear');
    dispatch(clearWishLists());
  };

  const validateWishListEvent = () => {
    setValidate(true);
  };

  const resetToChoosyVoltron = () => {
    ga('send', 'event', 'WishList', 'Reset to choosy voltron');
    setLiveWishListSource(choosyVoltronLocation);
    reloadWishList(choosyVoltronLocation);
  };

  const resetToVoltron = () => {
    ga('send', 'event', 'WishList', 'Reset to voltron');
    setLiveWishListSource(voltronLocation);
    reloadWishList(voltronLocation);
  };

  const updateWishListSourceState = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSource = e.target.value;
    setLiveWishListSource(newSource);
  };

  return (
    <section id="wishlist">
      <h2>
        {t('WishListRoll.Header')}
        <HelpLink helpLink="https://github.com/DestinyItemManager/DIM/blob/master/docs/COMMUNITY_CURATIONS.md" />
      </h2>
      <div className="setting">
        <FileUpload onDrop={loadWishList} title={t('WishListRoll.Import')} />
      </div>

      <div className="setting">
        <div>{t('WishListRoll.PreMadeFiles')}</div>
        {voltronNotSelected && (
          <>
            <div>
              <button type="button" className="dim-button" onClick={resetToVoltron}>
                <span>{t('WishListRoll.Voltron')}</span>
              </button>
            </div>
            <div className="fineprint">{t('WishListRoll.VoltronDescription')}</div>
            {choosyVoltronNotSelected && <p className="fineprint" />}
          </>
        )}
        {choosyVoltronNotSelected && (
          <>
            <div>
              <button type="button" className="dim-button" onClick={resetToChoosyVoltron}>
                <span>{t('WishListRoll.ChoosyVoltron')}</span>
              </button>
            </div>
            <div className="fineprint">{t('WishListRoll.ChoosyVoltronDescription')}</div>
          </>
        )}
      </div>

      <div className="setting">
        <div>{t('WishListRoll.ExternalSource')}</div>
        <div>
          <input
            type="text"
            className="wish-list-text"
            value={liveWishListSource}
            onChange={updateWishListSourceState}
            placeholder={t('WishListRoll.ExternalSource')}
          />
        </div>
        <div>
          <input
            type="button"
            className="dim-button"
            value={t('WishListRoll.UpdateExternalSource')}
            onClick={wishListUpdateEvent}
          />
        </div>

        {wishListLastUpdated && (
          <div className="fineprint">
            {t('WishListRoll.LastUpdated', {
              lastUpdatedDate: wishListLastUpdated.toLocaleDateString(),
              lastUpdatedTime: wishListLastUpdated.toLocaleTimeString(),
            })}
          </div>
        )}
      </div>

      {wishListSource && (
        <div className="setting">
          <div className="horizontal">
            <label>
              {t('WishListRoll.Num', {
                num: numWishListRolls,
              })}
            </label>
            <button type="button" className="dim-button" onClick={clearWishListEvent}>
              {t('WishListRoll.Clear')}
            </button>
            {$DIM_FLAVOR === 'dev' && (
              <button type="button" className="dim-button" onClick={validateWishListEvent}>
                Validate
              </button>
            )}
          </div>
          {wishList.infos.map(({ title, description, numRolls }, idx) => (
            <div className="fineprint" key={idx}>
              <div>
                <b>{title || t('WishListRoll.Untitled')}</b>{' '}
                {wishList.infos.length > 1 && <i>({numRolls})</i>}
              </div>
              <div>{description}</div>
            </div>
          ))}
        </div>
      )}

      {wishListSource && validate && (
        <div className="setting">
          <WishlistValidation rolls={wishList.wishListRolls} />
        </div>
      )}
    </section>
  );
}

type ErrorCode =
  | { code: 'missing_hash' }
  | { code: 'missing_perk'; perkHash: number }
  | { code: 'perk_columns'; perksHashes: number[]; numCols: number };

type Error = { itemHash: number; code: ErrorCode };

function WishlistValidation({ rolls }: { rolls: WishListRoll[] }) {
  const defs = useD2Definitions()!;
  const buckets = useSelector(bucketsSelector)!;

  const fakeItems: { [key: number]: DimItem } = {};
  const errors: Error[] = [];

  for (const roll of rolls) {
    if (!fakeItems[roll.itemHash]) {
      const fakeItem = makeFakeItem(defs, buckets, undefined, roll.itemHash);
      if (!fakeItem) {
        errors.push({ itemHash: roll.itemHash, code: { code: 'missing_hash' } });
        continue;
      }
      fakeItems[roll.itemHash] = fakeItem;
    }

    const fakeItem = fakeItems[roll.itemHash]!;
    const findSocketIndices = (perkHash: number) =>
      fakeItem.sockets?.allSockets
        .filter((s) => s.plugOptions.some((p) => perkHash === p.plugDef.hash))
        .map((s) => s.socketIndex);

    const perksPerSocket: Map<number, number[]> = new Map();

    for (const perk of roll.recommendedPerks) {
      const indices = findSocketIndices(perk);
      if (!indices || !indices.length) {
        errors.push({ itemHash: roll.itemHash, code: { code: 'missing_perk', perkHash: perk } });
        continue;
      }

      indices.forEach((i) => {
        if (!perksPerSocket.get(i)) {
          perksPerSocket.set(i, []);
        }
        perksPerSocket.get(i)!.push(perk);
      });
    }

    // Remove columns with only a single valid wishlisted perk
    const socketPerks = Array.from(perksPerSocket.entries());
    for (const [idx, perks] of perksPerSocket.entries()) {
      if (
        perks.length === 1 &&
        socketPerks.every(
          ([otherIdx, otherPerks]) => idx === otherIdx || !otherPerks.includes(perks[0])
        )
      ) {
        perksPerSocket.delete(idx);
      }
    }

    const numSockets = perksPerSocket.size;
    const perks = _.uniq(Array.from(perksPerSocket.values()).flatMap((x) => x));

    if (numSockets < perks.length) {
      errors.push({
        itemHash: roll.itemHash,
        code: {
          code: 'perk_columns',
          perksHashes: [...perks].sort(),
          numCols: numSockets,
        },
      });
    }
  }

  const unique = _.uniqWith(errors, (l: Error, r: Error) => _.isEqual(l, r));

  const formatItem = (itemHash: number) => {
    const item = defs.InventoryItem.get(itemHash);
    return (
      <a href={`https://data.destinysets.com/i/InventoryItem:${itemHash}`}>
        {item?.displayProperties.name || itemHash}
      </a>
    );
  };

  const formatError = (e: Error) => {
    switch (e.code.code) {
      case 'missing_hash': {
        return <span>Item not found</span>;
      }
      case 'missing_perk': {
        return (
          <>
            <span>Perk </span>
            {formatItem(e.code.perkHash)}
            <span> not found</span>
          </>
        );
      }
      case 'perk_columns': {
        return (
          <>
            <span>{`${e.code.perksHashes.length} perks `}</span>
            {e.code.perksHashes.map((perk, idx) => (
              <span key={idx}>
                {idx > 0 && ', '}
                {formatItem(perk)}
              </span>
            ))}
            <span>{` only roll in ${e.code.numCols} different columns`}</span>
          </>
        );
      }
    }
  };

  const borders = { border: '1px solid grey', borderCollapse: 'collapse' } as const;

  return (
    <table style={borders}>
      <thead>
        <tr>
          <th style={borders}>Item</th>
          <th style={borders}>Message</th>
        </tr>
      </thead>
      <tbody>
        {unique.map((e, idx) => (
          <tr key={idx}>
            <td style={borders}>{formatItem(e.itemHash)}</td>
            <td style={{ whiteSpace: 'normal', ...borders }}>{formatError(e)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
