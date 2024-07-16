/**
 * The original of this source file is
 * https://github.com/chakra-ui/chakra-ui/issues/457#issuecomment-929686132
 */

import {
  Center,
  type CenterProps,
  Icon,
  useColorModeValue
} from '@chakra-ui/react';
import { useCallback } from 'react';
import { type Accept, useDropzone } from 'react-dropzone';
import { FaFileArrowUp } from 'react-icons/fa6';

interface DropZoneProps extends CenterProps {
  /** 許可ファイルタイプ */
  accept: Accept;
  /** ファイルを受けった時のコールバック */
  onFileAccepted: (file: File) => void;
}

/** ドロップ可能なファイル入力コンポーネント */
const DropZone: React.FC<DropZoneProps> = (props) => {
  const { accept, onFileAccepted, ...rest } = props;

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      onFileAccepted(acceptedFiles[0]);
    },
    [onFileAccepted]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles: 1,
    multiple: false
  });

  const dropText = isDragActive ? 'ファイルをドロップ' : 'ファイル選択';

  const activeBg = useColorModeValue('gray.100', 'gray.600');
  const borderColor = useColorModeValue(
    isDragActive ? 'teal.300' : 'gray.300',
    isDragActive ? 'teal.500' : 'gray.500'
  );

  return (
    <Center
      w="12em"
      p={1}
      cursor="pointer"
      bg={isDragActive ? activeBg : 'transparent'}
      _hover={{ bg: activeBg }}
      transition="background-color 0.2s ease"
      borderRadius={4}
      border="1px dashed"
      borderColor={borderColor}
      {...getRootProps()}
      {...rest}
    >
      <input {...getInputProps()} />
      <Icon as={FaFileArrowUp} mr={2} w="18px" h="18px" />
      <p>{dropText}</p>
    </Center>
  );
};

export default DropZone;
