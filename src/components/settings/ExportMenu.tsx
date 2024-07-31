import { DownloadIcon } from '@chakra-ui/icons';
import {
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList
} from '@chakra-ui/react';
import type React from 'react';
import type { SimulationData } from '../../logics/SimulationData';
import { toBoardCsv } from '../../logics/board-csv';
import { toBoardJson } from '../../logics/board-json';

const BOM = new Uint8Array([0xef, 0xbb, 0xbf]);

/** 出力メニュー */
const ExportMenu: React.FC<{ simulationData: SimulationData }> = (props) => {
  const { simulationData } = props;

  const onCsvExport = () => {
    const url = URL.createObjectURL(
      new Blob([BOM, toBoardCsv(simulationData)], { type: 'text/csv' })
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'board.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const onJsonExport = () => {
    const url = URL.createObjectURL(
      new Blob([BOM, toBoardJson(simulationData)], { type: 'application/json' })
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'board.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Menu>
      <MenuButton padding={0} as={'div'}>
        <IconButton
          variant={'outline'}
          aria-label="盤面を編集"
          icon={<DownloadIcon />}
        />
      </MenuButton>
      <MenuList>
        <MenuItem onClick={onCsvExport}>CSV 出力</MenuItem>
        <MenuItem onClick={onJsonExport}>JSON 出力</MenuItem>
      </MenuList>
    </Menu>
  );
};

export default ExportMenu;
