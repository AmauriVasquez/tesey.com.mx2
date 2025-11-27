import React from 'react';
import { Badge } from '@/components/ui/badge';

const EstatusPedidoBadge = ({ estatus }) => {
  const styles = {
    'Pendiente': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'Surtido': 'bg-green-100 text-green-800 border-green-200',
    'Cancelado': 'bg-red-100 text-red-800 border-red-200'
  };
  return <Badge variant="outline" className={styles[estatus]}>{estatus}</Badge>;
};

export default EstatusPedidoBadge;