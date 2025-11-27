import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Trash2, Loader2, MessageSquare, ToyBrick, Cuboid, Package, Building2, Printer, ShieldCheck } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';
import SeleccionarFormatoDialog from '@/components/pedidos/SeleccionarFormatoDialog';
import AutorizarPedidoDialog from '@/components/pedidos/AutorizarPedidoDialog';

const NuevoPedidoDialog = ({ open, onOpenChange, onSave, pedidoGuardado, proyecto: proyectoPrefijado, onPedidoUpdated }) => {
  const { toast } = useToast();
  const { user } = useAuth();

  const [solicitanteId, setSolicitanteId] = useState('');
  const [tipoAsociacion, setTipoAsociacion] = useState('proyecto');
  const [asociacionId, setAsociacionId] = useState('');
  const [observacionesGenerales, setObservacionesGenerales] = useState('');
  const [items, setItems] = useState([]);
  const [materialSeleccionado, setMaterialSeleccionado] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Status Management
  const [estatus, setEstatus] = useState('Pendiente');
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // State for format selection dialog
  const [showFormatSelection, setShowFormatSelection] = useState(false);
  const [currentPedidoData, setCurrentPedidoData] = useState(null);
  
  const [usuarios, setUsuarios] = useState([]);
  const [proyectosActivos, setProyectosActivos] = useState([]);
  const [catalogoMateriales, setCatalogoMateriales] = useState([]);
  const [cuentasGasto] = useState(['Consumibles', 'Mantenimiento', 'Edificio', 'Activos', 'Herramienta']);
  const [categoriaMaterial, setCategoriaMaterial] = useState('Materiales');
  
  const statusOptions = [
    'Pendiente',
    'Autorizado',
    'Pago Pendiente',
    'Recolección Pendiente',
    'Entrega Pendiente',
    'Entregado'
  ];

  const isProjectLocked = !!proyectoPrefijado;
  const isEditing = !!pedidoGuardado; 

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
        const promises = [
            supabase.from('materiales').select('id, descripcion, unidad_compra, categoria'),
            supabase.from('usuarios').select('id, nombre_completo')
        ];
        if (!isProjectLocked) {
            promises.push(supabase.from('proyectos').select('id, folio, descripcion, cotizacion_folio').in('estatus', ['Por Iniciar', 'En Proceso', 'Detenido']));
        }
        
        const results = await Promise.all(promises);
        const materialesRes = results[0];
        const usersRes = results[1];
        const proyectosRes = !isProjectLocked ? results[2] : null;

        if (materialesRes.error) throw materialesRes.error;
        setCatalogoMateriales(materialesRes.data || []);

        if (usersRes.error) throw usersRes.error;
        setUsuarios(usersRes.data || []);

        if (!isProjectLocked) {
            if (proyectosRes.error) throw proyectosRes.error;
            setProyectosActivos(proyectosRes.data || []);
        } else {
            setProyectosActivos([proyectoPrefijado]);
        }
    } catch (error) {
        console.error("Error fetching data:", error);
        toast({ 
            variant: 'destructive', 
            title: 'Error de conexión', 
            description: 'No se pudo cargar la información necesaria. Verifique su conexión o configuración.' 
        });
    } finally {
        setLoading(false);
    }
  }, [toast, isProjectLocked, proyectoPrefijado]);
  
  useEffect(() => {
    if (open) {
      fetchData();
      if (!pedidoGuardado) {
        // Reset form for new order
        setSolicitanteId(user?.id || '');
        setTipoAsociacion(isProjectLocked ? 'proyecto' : 'proyecto');
        setAsociacionId(isProjectLocked ? proyectoPrefijado.id.toString() : '');
        setItems([]);
        setMaterialSeleccionado('');
        setCantidad('');
        setObservaciones('');
        setObservacionesGenerales('');
        setEstatus('Pendiente');
        setCategoriaMaterial('Materiales');
        setCurrentPedidoData(null);
      } else {
        // Load existing order data
        setSolicitanteId(pedidoGuardado.solicitante_id || '');
        setTipoAsociacion(pedidoGuardado.proyecto_id ? 'proyecto' : 'cuenta');
        setAsociacionId(pedidoGuardado.proyecto_id ? pedidoGuardado.proyecto_id.toString() : pedidoGuardado.cuenta);
        setObservacionesGenerales(pedidoGuardado.observaciones || '');
        // Solo actualizamos si NO estamos en medio de una actualización manual para evitar el flasheo
        if (!updatingStatus) {
            setEstatus(pedidoGuardado.estatus || 'Pendiente');
        }
        
        let loadedItems = [];
        if (pedidoGuardado.items) {
            loadedItems = pedidoGuardado.items.map(i => ({
                id: i.material_id,
                descripcion: i.material?.descripcion || i.descripcion || 'Material',
                cantidad: i.cantidad,
                unidad: i.material?.unidad_compra || i.unidad || '',
                observaciones: i.observaciones || ''
            }));
        } else if (pedidoGuardado.pedidos_materiales_items) {
             loadedItems = pedidoGuardado.pedidos_materiales_items.map(i => ({
                id: i.material_id,
                descripcion: i.materiales?.descripcion || 'Material',
                cantidad: i.cantidad,
                unidad: i.materiales?.unidad_compra || '',
                observaciones: i.observaciones || ''
            }));
        }
        setItems(loadedItems);
        setCurrentPedidoData({
            ...pedidoGuardado,
            items: loadedItems
        });
      }
    }
  }, [open, fetchData, pedidoGuardado, user, isProjectLocked, proyectoPrefijado]);

  const handleAddItem = () => {
    if (!materialSeleccionado || !cantidad || parseFloat(cantidad) <= 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Selecciona un material y una cantidad válida.' });
      return;
    }
    const material = catalogoMateriales.find(m => m.id.toString() === materialSeleccionado);
    if (!material) return;
    
    setItems(prevItems => [...prevItems, { id: material.id, descripcion: material.descripcion, cantidad: parseFloat(cantidad), unidad: material.unidad_compra, observaciones }]);
    setMaterialSeleccionado('');
    setCantidad('');
    setObservaciones('');
  };

  const handleRemoveItem = index => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!solicitanteId) { toast({ variant: 'destructive', title: 'Error', description: 'Debes seleccionar un solicitante.' }); return; }
    if (!asociacionId) { toast({ variant: 'destructive', title: 'Error', description: 'Debes asociar el pedido a un proyecto o cuenta.' }); return; }
    if (items.length === 0) { toast({ variant: 'destructive', title: 'Error', description: 'Debes agregar al menos un material al pedido.' }); return; }
    
    setIsSaving(true);
    try {
        // Pass status as well
        const savedPedido = await onSave({ 
            solicitante_id: solicitanteId, 
            tipo: tipoAsociacion, 
            asociacionId, 
            observaciones_generales: observacionesGenerales, 
            items,
            estatus // Pass current status
        });
        
        const proyecto = tipoAsociacion === 'proyecto' ? (proyectosActivos.find(p => p.id.toString() === asociacionId) || proyectoPrefijado) : null;
        const solicitante = usuarios.find(u => u.id === solicitanteId);
        
        const dataForPreview = savedPedido || {
             folio: 'NUEVO (Guardado)', 
             fecha: new Date(),
             proyecto,
             cuenta: tipoAsociacion === 'cuenta' ? asociacionId : null,
             solicitante,
             observaciones_generales: observacionesGenerales,
             items 
        };
        
        setCurrentPedidoData(dataForPreview);
        setShowFormatSelection(true);
        
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Error', description: 'Hubo un problema al guardar el pedido.' });
    } finally {
        setIsSaving(false);
    }
  };
  
  const handleStatusChange = async (newStatus) => {
      setEstatus(newStatus);
      if (isEditing && pedidoGuardado?.id) {
          setUpdatingStatus(true);
          try {
              const { error } = await supabase
                  .from('pedidos_materiales')
                  .update({ estatus: newStatus })
                  .eq('id', pedidoGuardado.id);
                  
              if (error) throw error;
              
              toast({
                  title: "Estatus Actualizado",
                  description: `El pedido ha cambiado a ${newStatus}.`
              });
              
              // Update local preview data
              setCurrentPedidoData(prev => ({ ...prev, estatus: newStatus }));
              // NUEVO: Avisar al componente padre que recargue los datos de la tabla
              if (onPedidoUpdated) {
                  await onPedidoUpdated();
              }
          } catch (error) {
              console.error(error);
              toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el estatus.' });
              // Revert on error
              setEstatus(pedidoGuardado.estatus); 
          } finally {
              setUpdatingStatus(false);
          }
      }
  };
  
  const handleAuthorizationSuccess = async () => {
      await handleStatusChange('Autorizado');
  };
  
  const getPedidoDataForFormat = () => {
      if (currentPedidoData) return currentPedidoData;
      const proyecto = tipoAsociacion === 'proyecto' ? (proyectosActivos.find(p => p.id.toString() === asociacionId) || proyectoPrefijado) : null;
      const solicitante = usuarios.find(u => u.id === solicitanteId);
      return { 
          folio: pedidoGuardado?.folio || 'BORRADOR',
          fecha: pedidoGuardado?.fecha || new Date(), 
          proyecto, 
          cuenta: tipoAsociacion === 'cuenta' ? asociacionId : null, 
          solicitante: solicitante || { nombre_completo: 'Usuario no encontrado' }, 
          observaciones_generales: observacionesGenerales, 
          items,
          estatus
      };
  };

  const materialOptions = useMemo(() => {
    return catalogoMateriales.filter(m => m.categoria === categoriaMaterial).map(m => ({ value: m.id.toString(), label: m.descripcion }));
  }, [catalogoMateriales, categoriaMaterial]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>{pedidoGuardado ? `Detalle Pedido: ${pedidoGuardado.folio}` : 'Nuevo Pedido de Materiales'}</DialogTitle></DialogHeader>
          
          {loading ? <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div> : (
            <div className="max-h-[70vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 py-4">
                {/* Estatus Section - Top Right for visibility */}
                <div className="md:col-span-2 flex justify-end items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100 mb-2">
                    <div className="flex items-center gap-2 flex-1">
                        <Label htmlFor="estatus-select" className="font-bold text-gray-700">Estatus Actual:</Label>
                        <div className="w-48">
                            <Select 
                                value={estatus} 
                                onValueChange={handleStatusChange}
                                disabled={!isEditing || updatingStatus}
                            >
                                <SelectTrigger id="estatus-select" className={cn(
                                    "font-semibold",
                                    estatus === 'Pendiente' && "text-yellow-600",
                                    estatus === 'Autorizado' && "text-green-600",
                                    estatus === 'Entregado' && "text-blue-600"
                                )}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {statusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        {updatingStatus && <Loader2 className="w-4 h-4 animate-spin text-gray-500" />}
                    </div>
                    
                    {estatus === 'Pendiente' && (
                        <Button 
                            onClick={() => setShowAuthDialog(true)}
                            className="bg-amber-600 hover:bg-amber-700 text-white gap-2 shadow-sm"
                            size="sm"
                        >
                            <ShieldCheck className="w-4 h-4" />
                            Autorizar Pedido
                        </Button>
                    )}
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="solicitante-select">Solicitante</Label>
                  <Select value={solicitanteId} onValueChange={setSolicitanteId} disabled={isEditing}><SelectTrigger id="solicitante-select"><SelectValue placeholder="Seleccione un solicitante..." /></SelectTrigger><SelectContent>{usuarios.map(u => <SelectItem key={u.id} value={u.id}>{u.nombre_completo}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="space-y-4 md:col-span-2">
                  <h3 className="font-semibold text-gray-800 border-t pt-4">Asociar Pedido</h3>
                  <Tabs value={tipoAsociacion} onValueChange={v => { if (!isProjectLocked && !isEditing) { setTipoAsociacion(v); setAsociacionId(''); } }}>
                    <TabsList className={cn("grid w-full", isProjectLocked ? "grid-cols-1" : "grid-cols-2")}><TabsTrigger value="proyecto" disabled={isProjectLocked || isEditing}>Proyecto</TabsTrigger>{!isProjectLocked && <TabsTrigger value="cuenta" disabled={isEditing}>Cuenta</TabsTrigger>}</TabsList>
                    <div className="mt-4">
                        {tipoAsociacion === 'proyecto' && (
                            <>
                                <Label htmlFor="proyecto-select">Seleccionar Proyecto Activo</Label>
                                <Select value={asociacionId} onValueChange={setAsociacionId} disabled={isProjectLocked || isEditing}><SelectTrigger id="proyecto-select"><SelectValue placeholder="Elige un proyecto..." /></SelectTrigger><SelectContent>{proyectosActivos.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.folio} - {p.descripcion}</SelectItem>)}</SelectContent></Select>
                            </>
                        )}
                        {tipoAsociacion === 'cuenta' && !isProjectLocked && (
                            <>
                                <Label htmlFor="cuenta-select">Seleccionar Cuenta de Gasto</Label>
                                <Select value={asociacionId} onValueChange={setAsociacionId} disabled={isEditing}><SelectTrigger id="cuenta-select"><SelectValue placeholder="Elige una cuenta..." /></SelectTrigger><SelectContent>{cuentasGasto.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                            </>
                        )}
                    </div>
                  </Tabs>
                </div>
                <div className="space-y-2 md:col-span-2"><h3 className="font-semibold text-gray-800 border-t pt-4">Observaciones Generales del Pedido</h3><Textarea placeholder="Añade aquí cualquier instrucción o comentario general sobre el pedido..." value={observacionesGenerales} onChange={e => setObservacionesGenerales(e.target.value)} disabled={isEditing} /></div>
                
                {!isEditing && (
                    <div className="space-y-4 md:col-span-2"><h3 className="font-semibold text-gray-800 border-t pt-4">Agregar Materiales</h3><Tabs value={categoriaMaterial} onValueChange={(value) => { setCategoriaMaterial(value); setMaterialSeleccionado(''); }}><TabsList className="grid w-full grid-cols-4"><TabsTrigger value="Materiales" className="gap-2"><Package className="w-4 h-4"/>Materiales</TabsTrigger><TabsTrigger value="Consumibles" className="gap-2"><ToyBrick className="w-4 h-4"/>Consumibles</TabsTrigger><TabsTrigger value="Activos" className="gap-2"><Cuboid className="w-4 h-4"/>Activos</TabsTrigger><TabsTrigger value="Edificio" className="gap-2"><Building2 className="w-4 h-4"/>Edificio</TabsTrigger></TabsList></Tabs><div className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-end"><div className="sm:col-span-2"><Label htmlFor="material-select">Material</Label><Combobox options={materialOptions} value={materialSeleccionado} onChange={setMaterialSeleccionado} placeholder="Busca un material..." searchPlaceholder="Buscar material..." notFoundMessage="No se encontró el material." /></div><div><Label htmlFor="cantidad">Cantidad</Label><Input id="cantidad" type="number" value={cantidad} onChange={e => setCantidad(e.target.value)} placeholder="Ej. 10" /></div><div className="sm:col-span-2"><Label htmlFor="observaciones">Observaciones</Label><Input id="observaciones" value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Opcional (por partida)" /></div></div><Button onClick={handleAddItem} className="w-full gap-2"><PlusCircle className="w-4 h-4" />Añadir Partida</Button></div>
                )}
              </div>
              <div className="space-y-2 mt-4"><h3 className="font-semibold text-gray-800">Resumen del Pedido</h3><div className="border rounded-lg max-h-60 overflow-y-auto">{items.length > 0 ? <ul className="divide-y">{items.map((item, index) => <li key={index} className="flex justify-between items-start p-3"><div className="flex-1"><p className="text-sm font-medium">{item.cantidad} {item.unidad} - {item.descripcion}</p>{item.observaciones && <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-1"><MessageSquare className="w-3 h-3" /> {item.observaciones}</p>}</div>{!isEditing && <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => handleRemoveItem(index)}><Trash2 className="w-4 h-4 text-red-500" /></Button>}</li>)}</ul> : <p className="text-center text-sm text-gray-500 p-4">Aún no has agregado materiales.</p>}</div></div>
            </div>
          )}

          <DialogFooter className="mt-6 gap-2">
              <DialogClose asChild><Button variant="outline" disabled={isSaving}>Cerrar</Button></DialogClose>
              {isEditing ? (
                   <Button onClick={() => setShowFormatSelection(true)} className="gap-2 bg-blue-600 hover:bg-blue-700">
                       <Printer className="w-4 h-4" /> Imprimir Formato
                   </Button>
              ) : (
                   <Button onClick={handleSave} disabled={isSaving || items.length === 0 || loading}>
                       {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                       {isSaving ? 'Guardando...' : 'Guardar y Generar Formato'}
                   </Button>
              )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <SeleccionarFormatoDialog 
        open={showFormatSelection} 
        onOpenChange={setShowFormatSelection}
        pedidoData={getPedidoDataForFormat()}
      />

      <AutorizarPedidoDialog
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
        onAuthorized={handleAuthorizationSuccess}
      />
    </>
  );
};

export default NuevoPedidoDialog;