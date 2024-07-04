import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type React from 'react';
import btn from '../styles/Button.module.css';

interface IProps {
  /** ツールチップID */
  tooltipId: string;
  /** Font Awesome のアイコン */
  icon?: IconProp;
  /** ボタンの文字列 */
  text?: string;
  /** クリックハンドラ */
  onClicked: () => void;
  /** disabled状態かどうか */
  disabled?: boolean;
}

/** アイコンボタン */
const IconButton: React.FC<IProps> = (props) => {
  const { tooltipId, icon, text, onClicked, disabled } = props;

  return (
    <button
      className={btn.button}
      type="button"
      data-tooltip-id={tooltipId}
      disabled={disabled}
      onClick={onClicked}
    >
      {icon ? <FontAwesomeIcon icon={icon} /> : ''}
      {text}
    </button>
  );
};

export default IconButton;
