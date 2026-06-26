import { SearchIcon, SettingsIcon } from 'lucide-react';
import type React from 'react';

import ExplorationPanel from '@/components/panels/ExplorationPanel';
import FieldSettingsPanel from '@/components/panels/FieldSettingsPanel';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet';
import BoardControls from './BoardControls';
import ThemeToggle from './ThemeToggle';

/**
 * Top app bar. On desktop/tablet (md+) the board controls sit inline; on mobile
 * they collapse into bottom sheets opened from the gear / search buttons.
 */
const TopBar: React.FC = () => {
  return (
    <header className="app-topbar flex items-center gap-2">
      <span className="font-heading text-lg font-bold tracking-tight">
        Puyomist
      </span>

      {/* md+: inline board controls */}
      <div className="ml-2 hidden md:flex">
        <BoardControls />
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {/* mobile: settings / exploration sheets */}
        <div className="flex items-center gap-1.5 md:hidden">
          <Sheet>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  aria-label="フィールド設定を開く"
                />
              }
            >
              <SettingsIcon />
            </SheetTrigger>
            <SheetContent side="bottom" className="app-sheet-body">
              <SheetHeader>
                <SheetTitle>フィールド設定</SheetTitle>
              </SheetHeader>
              <div className="px-5 pb-5">
                <BoardControls className="mb-4" />
                <FieldSettingsPanel />
              </div>
            </SheetContent>
          </Sheet>

          <Sheet>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  aria-label="探索設定を開く"
                />
              }
            >
              <SearchIcon />
            </SheetTrigger>
            <SheetContent side="bottom" className="app-sheet-body">
              <SheetHeader>
                <SheetTitle>探索</SheetTitle>
              </SheetHeader>
              <div className="px-5 pb-5">
                <ExplorationPanel />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <ThemeToggle />
      </div>
    </header>
  );
};

export default TopBar;
