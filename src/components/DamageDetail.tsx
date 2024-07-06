import type React from 'react';
import { PuyoAttribute, getPuyoAttributeName } from '../logics/PuyoAttribute';
import type { ChainDamage } from '../logics/damage';
import styles from './DamageDetail.module.css';

interface IProps {
  /** ダメージ表示するぷよの種類 */
  attr: PuyoAttribute;

  /** 連鎖ダメージリスト */
  chainDamages: ChainDamage[];
}

/** あるぷよ色におけるダメージ詳細 */
const DamageDetail: React.FC<IProps> = (props) => {
  const { chainDamages, attr } = props;
  const attrName = getPuyoAttributeName(attr);

  const chainDamagesByAttr = chainDamages
    .filter((chain) => {
      const damageTerm = chain.damageTerms[attr];
      return typeof damageTerm !== 'undefined';
    })
    .map((chain) => {
      return {
        chainNum: chain.chainNum,
        poppedPuyoNum: chain.poppedPuyoNum,
        damageTerm: chain.damageTerms[attr]
      };
    });

  const totalDamageByPrism = chainDamages
    .map((chain) => {
      return chain.damageTerms[PuyoAttribute.Prism];
    })
    .reduce((m, damageTerm) => {
      return m + (damageTerm?.strength ?? 0);
    }, 0);

  const totalAttrDamage = (
    totalDamageByPrism +
    chainDamagesByAttr.reduce((m, chain) => m + chain.damageTerm.strength, 0)
  ).toFixed(2);

  const totalAttrPoppedNum = chainDamagesByAttr.reduce(
    (m, chain) => m + chain.damageTerm.poppedNum,
    0
  );

  // (連鎖目-分離数-同時消し数) リスト
  const cspList = chainDamagesByAttr.map((chain) => {
    return `${chain.chainNum}-${chain.damageTerm.separatedBlocksNum}-${chain.poppedPuyoNum}`;
  });

  return (
    <div>
      {attrName}: <span>{totalAttrDamage}</span>{' '}
      <span className={styles.poppedNum}>({totalAttrPoppedNum}個)</span>
      <span className={styles.appendix}>{cspList.join(', ')}</span>
    </div>
  );
};

export default DamageDetail;
