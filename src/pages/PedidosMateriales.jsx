
import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { Eye, PlusCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { format } from 'date-fns';
import NuevoPedidoDialog from '@/components/pedidos/NuevoPedidoDialog';
import EstatusPedidoBadge from '@/components/pedidos/EstatusPedidoBadge';

const PedidosMateriales = ({ isEmbedded = false }) => {
  const { toast } = useToast();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nuevoPedidoDialogOpen, setNuevoPedidoDialogOpen] = useState(false);
  const [pedidoGuardado, setPedidoGuardado] = useState(null);

  const fetchPedidos = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('pedidos_materiales')
      .select(`
        *, 
        proyecto:proyecto_id(folio, descripcion, cotizacion_folio), 
        solicitante:solicitante_id(nombre_completo),
        pedidos_materiales_items(
            cantidad,
            observaciones,
            material_id,
            materiales(descripcion, unidad_compra)
        )
      `)
      .order('id', { ascending: false });
    
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los pedidos.' });
    } else {
      setPedidos(data);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchPedidos();
  }, [fetchPedidos]);

  const handleCreatePedido = async ({ solicitante_id, tipo, asociacionId, observaciones_generales, items }) => {
    // Use maybeSingle() instead of single() to gracefully handle the case where no rows exist (first order)
    const { data: lastPedido, error: folioError } = await supabase
      .from('pedidos_materiales')
      .select('folio')
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
      
    if (folioError) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo generar el folio.' });
      console.error('Error generating folio:', folioError);
      return null;
    }

    const nextFolioNumber = lastPedido ? parseInt(lastPedido.folio.split('-')[1]) + 1 : 1;
    const newFolio = `PED-${String(nextFolioNumber).padStart(4, '0')}`;

    const pedidoData = {
      folio: newFolio,
      fecha: new Date().toISOString().split('T')[0],
      solicitante_id,
      estatus: 'Pendiente',
      proyecto_id: tipo === 'proyecto' ? asociacionId : null,
      cuenta: tipo === 'cuenta' ? asociacionId : null,
      observaciones: observaciones_generales,
    };

    const { data: newPedido, error: pedidoError } = await supabase.from('pedidos_materiales').insert(pedidoData).select().single();
    if (pedidoError) {
      toast({ variant: 'destructive', title: 'Error', description: pedidoError.message });
      return null;
    }

    const itemsToInsert = items.map(item => ({ pedido_id: newPedido.id, material_id: item.id, cantidad: item.cantidad, observaciones: item.observaciones }));
    const { error: itemsError } = await supabase.from('pedidos_materiales_items').insert(itemsToInsert);
    if (itemsError) {
      toast({ variant: 'destructive', title: 'Error guardando partidas', description: itemsError.message });
      // Consider rolling back the pedido creation
      return null;
    }

    toast({ title: '✅ Pedido Creado', description: `Se creó el pedido ${newFolio}.` });
    setPedidoGuardado(newPedido);
    fetchPedidos();
    
    // Return the complete object for the dialog to use for preview
    // We need to reconstruct it slightly to match what the dialog expects if it uses the result
    return {
        ...newPedido,
        items: items // pass items directly for preview so we don't need to refetch immediately
    };
  };

  const handleOpenNewPedidoDialog = () => {
    setPedidoGuardado(null);
    setNuevoPedidoDialogOpen(true);
  };

  const handleViewPedido = (pedido) => {
      setPedidoGuardado(pedido);
      setNuevoPedidoDialogOpen(true);
  };

  const MainContent = () => (
    <div className="space-y-6">
      {!isEmbedded && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Pedidos de Materiales</h2>
            <p className="text-gray-600 mt-1">Consulta el historial de solicitudes y su relación con las órdenes de compra.</p>
          </div>
        </div>
      )}
      <div className="flex justify-end">
        <Button onClick={handleOpenNewPedidoDialog} className="gap-2">
            <PlusCircle className="w-4 h-4" /> Nuevo Pedido
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
              {loading ? <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div> : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Folio Pedido</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asociado a</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Solicitante</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Orden de Compra</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estatus</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                      {pedidos.map(pedido => (
                          <tr key={pedido.id} className="hover:bg-gray-50">
                              <td className="px-4 py-4 font-medium text-blue-600">{pedido.folio}</td>
                              <td className="px-4 py-4 text-sm text-gray-800">{pedido.proyecto?.folio || `Cuenta: ${pedido.cuenta}`}</td>
                              <td className="px-4 py-4 text-sm text-gray-600">{format(new Date(pedido.fecha + 'T00:00:00'), 'dd/MMM/yyyy')}</td>
                              <td className="px-4 py-4 text-sm text-gray-800">{pedido.solicitante?.nombre_completo || 'N/A'}</td>
                              <td className="px-4 py-4 text-sm">{pedido.oc_folio ? <span className="font-mono text-purple-700">{pedido.oc_folio}</span> : <Button size="sm" variant="link" className="p-0 h-auto" onClick={() => toast({ title: '🚧 Función en desarrollo' })}>Relacionar OC</Button>}</td>
                              <td className="px-4 py-4"><EstatusPedidoBadge estatus={pedido.estatus} /></td>
                              <td className="px-4 py-4 text-right"><Button variant="ghost" size="icon" onClick={() => handleViewPedido(pedido)}><Eye className="w-4 h-4" /></Button></td>
                          </tr>
                      ))}
                  </tbody>
              </table>
              )}
              {pedidos.length === 0 && !loading && <p className="text-center py-10 text-gray-500">No hay pedidos registrados.</p>}
          </div>
      </div>
      
      <NuevoPedidoDialog 
        open={nuevoPedidoDialogOpen} 
        onOpenChange={setNuevoPedidoDialogOpen}
        onSave={handleCreatePedido}
        pedidoGuardado={pedidoGuardado}
      />
    </div>
  );

  return isEmbedded ? <MainContent /> : (
    <>
      <Helmet><title>Pedidos de Materiales - Sistema TESEY</title></Helmet>
      <MainContent />
    </>
  );
};

export default PedidosMateriales;
