import { DownloadIcon } from 'lucide-react';
import type React from 'react';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import type { ExplorationTarget } from '@/logics/ExplorationTarget';
import type { SimulationData } from '@/logics/SimulationData';
import { toBoardJson, toPuyomistJson } from '@/logics/app-json';
import { toBoardCsv } from '@/logics/board-csv';

const BOM = new Uint8Array([0xef, 0xbb, 0xbf]);

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Export menu (CSV / JSON / full JSON). */
const ExportMenu: React.FC<{
  simulationData: SimulationData;
  boostAreaKeyList: string[];
  explorationTarget: ExplorationTarget;
}> = (props) => {
  const { simulationData, boostAreaKeyList, explorationTarget } = props;

  const onCsvExport = () =>
    download(
      new Blob([BOM, toBoardCsv(simulationData)], { type: 'text/csv' }),
      'board.csv'
    );

  const onJsonExport = () =>
    download(
      new Blob([toBoardJson(simulationData)], { type: 'application/json' }),
      'board.json'
    );

  const onPuyomistJsonExport = () =>
    download(
      new Blob(
        [toPuyomistJson(simulationData, boostAreaKeyList, explorationTarget)],
        { type: 'application/json' }
      ),
      'puyomist.json'
    );

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="icon" aria-label="盤面を出力" />
        }
      >
        <DownloadIcon />
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" showArrow={false}>
        <div className="flex flex-col">
          <Button variant="ghost" className="justify-start" onClick={onCsvExport}>
            CSV 出力
          </Button>
          <Button
            variant="ghost"
            className="justify-start"
            onClick={onJsonExport}
          >
            JSON 出力
          </Button>
          <Button
            variant="ghost"
            className="justify-start"
            onClick={onPuyomistJsonExport}
          >
            JSON フル出力 (探索設定込み)
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ExportMenu;
