import { useSelector } from 'react-redux';
import { selectAppState } from './selectAppState';

export const usePuyoAppState = () => useSelector(selectAppState);
