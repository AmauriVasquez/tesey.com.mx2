import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ArrowLeft, Send, FileDown, Mail, PackagePlus, Pencil, AlertCircle, CheckCircle, Upload, Trash2, ShoppingCart, Loader2, File as FileIcon, Download, Image as ImageIcon, Check, User, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { EstatusBadge, estatusOptions, faseOptions } from './Proyectos';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import AgregarMaterialDialog from '@/components/proyectos/AgregarMaterialDialog';
import RegistrarAprobacionDialog from '@/components/proyectos/RegistrarAprobacionDialog';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const MaterialStatusIndicator = ({ materiales }) => {
    const materialesFaltantes = useMemo(() => 
        materiales && materiales.some(m => m.cant > m.stock),
        [materiales]
    );

    if (!materiales || materiales.length === 0) {
        return <span className="flex items-center gap-1.5 text-sm text-gray-500 font-medium"><CheckCircle className="w-4 h-4 text-gray-400" />Sin Materiales</span>;
    }

    if (materialesFaltantes) {
        return (
            <span className="flex items-center gap-1.5 text-sm text-red-600 font-medium">
                <AlertCircle className="w-4 h-4" />
                Materiales Faltantes
            </span>
        );
    }

    return (
        <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
            <CheckCircle className="w-4 h-4" />
            Materiales en Stock
        </span>
    );
};

const ProyectoDetalle = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [proyecto, setProyecto] = useState(null);
  const [comentario, setComentario] = useState('');
  const [bitacora, setBitacora] = useState([]);
  const [archivos, setArchivos] = useState([]);
  const [materiales, setMateriales] = useState([]);
  const [aprobaciones, setAprobaciones] = useState([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [addMaterialDialogOpen, setAddMaterialDialogOpen] = useState(false);
  const [addAprobacionDialogOpen, setAddAprobacionDialogOpen] = useState(false);
  const [imagenBitacora, setImagenBitacora] = useState(null);

  const bitacoraFileInputRef = useRef(null);
  const archivosProyectoInputRef = useRef(null);
  
  const isTerminadoOEntregado = proyecto?.estatus === 'Terminado' || proyecto?.estatus === 'Entregado';

  const sanitizeFilename = (filename) => {
    return filename.replace(/[^a-zA-Z0-9-_\.]/g, '_');
  };

  const fetchProyectoData = useCallback(async (isUpdate = false) => {
    if(!isUpdate) setLoading(true);
    try {
        const { data: proyectoData, error: proyectoError } = await supabase.from('proyectos').select('*, cliente:cliente_id(nombre), responsable:responsable_id(nombre_completo)').eq('id', id).single();
        if (proyectoError) throw proyectoError;

        const { data: bitacoraRawData, error: bitacoraError } = await supabase.from('proyecto_bitacora').select('*').eq('proyecto_id', id).order('created_at', { ascending: false });
        if (bitacoraError) throw bitacoraError;
        const bitacoraUserIds = [...new Set(bitacoraRawData.map(b => b.usuario_id))];

        const { data: aprobacionesRawData, error: aprobacionesError } = await supabase.from('proyecto_aprobaciones').select('*').eq('proyecto_id', id).order('created_at', { ascending: false });
        if (aprobacionesError) throw aprobacionesError;
        const aprobacionesUserIds = [...new Set(aprobacionesRawData.map(a => a.usuario_id))];
        
        const allUserIds = [...new Set([...bitacoraUserIds, ...aprobacionesUserIds])].filter(Boolean);
        let usersMap = {};
        if (allUserIds.length > 0) {
            const { data: usersData, error: usersError } = await supabase.from('usuarios').select('id, nombre_completo').in('id', allUserIds);
            if (usersError) throw usersError;
            usersMap = usersData.reduce((acc, u) => ({ ...acc, [u.id]: u.nombre_completo }), {});
        }

        const bitacoraData = bitacoraRawData.map(b => ({ ...b, usuario: { nombre_completo: usersMap[b.usuario_id] || 'Usuario desconocido' } }));
        const aprobacionesData = aprobacionesRawData.map(a => ({...a, usuario: { nombre_completo: usersMap[a.usuario_id] || 'Usuario desconocido' }}));

        const { data: archivosData, error: archivosError } = await supabase.from('proyecto_archivos').select('*').eq('proyecto_id', id).order('created_at', { ascending: false });
        if (archivosError) throw archivosError;

        const { data: materialesData, error: materialesError } = await supabase.from('proyecto_materiales').select('*, material:material_id(*)').eq('proyecto_id', id);
        if (materialesError) throw materialesError;

        const faseActual = faseOptions.find(f => f.nombre === proyectoData.fase) || { avance: proyectoData.avance || 0 };
        setProyecto({
            ...proyectoData,
            cliente: proyectoData.cliente?.nombre || proyectoData.cliente_nombre_externo,
            responsable: proyectoData.responsable?.nombre_completo,
            avance: faseActual.avance,
        });
        setBitacora(bitacoraData);
        setArchivos(archivosData);
        setMateriales(materialesData);
        setAprobaciones(aprobacionesData);

    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar el proyecto.' });
      console.error('Error fetching project data:', error);
      navigate('/proyectos');
    } finally {
      if(!isUpdate) setLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => {
    fetchProyectoData();
  }, [fetchProyectoData]);

  const updateFaseYAvance = async (nuevaFaseNombre) => {
    const nuevaFase = faseOptions.find(f => f.nombre === nuevaFaseNombre);
    if (!nuevaFase) return;

    let updates = { fase: nuevaFase.nombre };
    if (nuevaFase.nombre === 'Terminado') {
        updates.estatus = 'Terminado';
    }

    const { error } = await supabase.from('proyectos').update(updates).eq('id', id);
    if (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar la fase.' });
    } else {
        toast({ title: '✅ Fase Actualizada', description: `El proyecto avanzó a: ${nuevaFase.nombre}` });
        fetchProyectoData(true);
    }
  };

  const handleStatusChange = async (nuevoEstatus) => {
    let updates = { estatus: nuevoEstatus };
    if (nuevoEstatus === 'Entregado') {
        updates.fase = 'Terminado'; // Ensure fase is also 'Terminado'
        updates.estatus = 'Entregado'; 
    }
    const { error } = await supabase.from('proyectos').update(updates).eq('id', id);
    if (error) toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el estatus.' });
    else {
      toast({ title: '✅ Estatus Actualizado', description: `El proyecto ahora está "${nuevoEstatus}".` });
      fetchProyectoData(true);
    }
  };
  
  const handleAddComentario = async () => {
    if (isTerminadoOEntregado) return toast({ title: 'Proyecto terminado', description: 'No se pueden añadir más comentarios.' });
    if (!comentario.trim() && !imagenBitacora) return;
    setIsSubmitting(true);
    let imageUrl = null;
    if (imagenBitacora) {
        const sanitizedFilename = sanitizeFilename(imagenBitacora.name);
        const filePath = `bitacora/${id}/${Date.now()}_${sanitizedFilename}`;
        const { error: uploadError } = await supabase.storage.from('proyecto_archivos').upload(filePath, imagenBitacora);
        if (uploadError) {
            toast({ variant: 'destructive', title: 'Error de Carga', description: uploadError.message });
            setIsSubmitting(false);
            return;
        }
        imageUrl = supabase.storage.from('proyecto_archivos').getPublicUrl(filePath).data.publicUrl;
    }
    const { error } = await supabase.from('proyecto_bitacora').insert({ proyecto_id: id, usuario_id: user.id, comentario: comentario.trim(), imagen_url: imageUrl });
    setIsSubmitting(false);
    if (error) toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar el comentario.' });
    else {
      setComentario('');
      setImagenBitacora(null);
      if (bitacoraFileInputRef.current) bitacoraFileInputRef.current.value = "";
      fetchProyectoData(true);
    }
  };
  
  const handleBitacoraImageSelect = (e) => {
      if (e.target.files && e.target.files[0]) setImagenBitacora(e.target.files[0]);
  };

  const handleFileUpload = async (event) => {
    if (isTerminadoOEntregado) return toast({ title: 'Proyecto terminado', description: 'No se pueden subir más archivos.' });
    const file = event.target.files[0];
    if (!file) return;
    setIsUploading(true);
    const sanitizedFilename = sanitizeFilename(file.name);
    const filePath = `${id}/${Date.now()}_${sanitizedFilename}`;
    const { error: uploadError } = await supabase.storage.from('proyecto_archivos').upload(filePath, file);
    if (uploadError) {
      toast({ variant: 'destructive', title: 'Error de carga', description: uploadError.message });
      setIsUploading(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from('proyecto_archivos').getPublicUrl(filePath);
    const { error: dbError } = await supabase.from('proyecto_archivos').insert({ proyecto_id: id, nombre_archivo: file.name, url_archivo: publicUrl, tipo_archivo: file.type, tamano_archivo: file.size });
    setIsUploading(false);
    if (dbError) toast({ variant: 'destructive', title: 'Error', description: dbError.message });
    else {
      toast({ title: 'Archivo subido correctamente' });
      fetchProyectoData(true);
    }
  };

  const handleDeleteFile = async (fileId, fileUrl) => {
    if (isTerminadoOEntregado) return toast({ title: 'Proyecto terminado', description: 'No se pueden eliminar archivos.' });
    const path = decodeURIComponent(fileUrl.split('/proyecto_archivos/')[1]);
    const { error: storageError } = await supabase.storage.from('proyecto_archivos').remove([path]);
    if (storageError) { toast({ variant: 'destructive', title: 'Error', description: storageError.message }); return; }
    const { error: dbError } = await supabase.from('proyecto_archivos').delete().eq('id', fileId);
    if (dbError) toast({ variant: 'destructive', title: 'Error', description: dbError.message });
    else { toast({ title: '🗑️ Archivo eliminado' }); fetchProyectoData(true); }
  };
  
  const handleAddMaterialToProject = async (materialToAdd) => {
      if (isTerminadoOEntregado) return toast({ title: 'Proyecto terminado', description: 'No se pueden añadir materiales.' });
      const { error } = await supabase.from('proyecto_materiales').insert({ proyecto_id: id, material_id: materialToAdd.id, cantidad_requerida: materialToAdd.cant, comentario: materialToAdd.comentario });
      if(error) { toast({ variant: 'destructive', title: 'Error', description: 'No se pudo agregar el material.' }); }
      else {
          toast({ title: '✅ Material Agregado' });
          if(proyecto.fase === 'Planeación') {
            await updateFaseYAvance('Solicitud de Materiales');
          } else {
            fetchProyectoData(true);
          }
          setAddMaterialDialogOpen(false);
      }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-blue-600" /></div>;
  if (!proyecto) return null;
  
  const puedeMarcarTerminado = proyecto.fase === 'Revisión' && proyecto.estatus !== 'Terminado' && proyecto.estatus !== 'Entregado';
  const puedeMarcarEntregado = proyecto.estatus === 'Terminado' && proyecto.estatus !== 'Entregado';

  return (
    <>
      <Helmet><title>{`Proyecto ${proyecto.folio} - Sistema TESEY`}</title></Helmet>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <Button variant="outline" onClick={() => navigate('/proyectos')} className="gap-2 self-start"><ArrowLeft className="w-4 h-4" /> Volver</Button>
          <div className="flex items-center gap-2 sm:gap-3 self-stretch sm:self-center">
             {(puedeMarcarTerminado || puedeMarcarEntregado) && (
                 <DropdownMenu>
                     <DropdownMenuTrigger asChild>
                         <Button className="gap-2 flex-1 sm:flex-none bg-green-600 hover:bg-green-700">Completar Fase</Button>
                     </DropdownMenuTrigger>
                     <DropdownMenuContent>
                         {puedeMarcarTerminado && <DropdownMenuItem onSelect={() => updateFaseYAvance('Terminado')}>Marcar como Terminado</DropdownMenuItem>}
                         {puedeMarcarEntregado && <DropdownMenuItem onSelect={() => handleStatusChange('Entregado')}>Marcar como Entregado</DropdownMenuItem>}
                     </DropdownMenuContent>
                 </DropdownMenu>
             )}
            <Button variant="outline" onClick={() => toast({ title: '🚧 Función en desarrollo' })} className="gap-2 flex-1 sm:flex-none"><Mail className="w-4 h-4"/> Enviar</Button>
            <Button onClick={() => toast({ title: '🚧 Función en desarrollo' })} className="gap-2 flex-1 sm:flex-none"><FileDown className="w-4 h-4"/> Exportar</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-xl border shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{proyecto.descripcion}</h1>
                        <p className="text-blue-600 font-mono">{proyecto.folio}</p>
                    </div>
                    <EstatusBadge estatus={proyecto.estatus} />
                </div>
                
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400"/>
                        <span className="font-medium">{proyecto.responsable || 'No asignado'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-gray-400"/>
                        <span className="font-medium">Inicio: {proyecto.fecha_inicio ? format(parseISO(proyecto.fecha_inicio), 'dd/MMM/yyyy') : 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-gray-400"/>
                        <span className="font-medium">Fin: {proyecto.fecha_fin ? format(parseISO(proyecto.fecha_fin), 'dd/MMM/yyyy') : 'N/A'}</span>
                    </div>
                 </div>

                <div className="mt-4">
                    <div className="flex justify-between items-center mb-2">
                        <p className="text-sm font-medium text-gray-500">Avance:</p>
                        <p className="text-sm font-bold text-blue-700">{proyecto.fase}</p>
                    </div>
                    <Progress value={faseOptions.find(f => f.nombre === proyecto.fase)?.avance || 0} />
                </div>
                <div className="mt-6">
                    <h3 className="text-md font-semibold mb-3">Fases del Proyecto</h3>
                    <div className="flex items-center justify-between">
                        {faseOptions.map((fase, index) => {
                            const faseIndex = faseOptions.findIndex(p_fase => p_fase.nombre === proyecto.fase);
                            const isCompleted = index < faseIndex;
                            const isCurrent = index === faseIndex;
                            return (
                                <DropdownMenu key={fase.nombre}>
                                    <DropdownMenuTrigger asChild disabled={isTerminadoOEntregado}>
                                        <div className="flex-1 text-center cursor-pointer group">
                                            <div className="relative">
                                                <div className={cn("w-6 h-6 rounded-full mx-auto transition-all", 
                                                    isCompleted || isCurrent ? "bg-blue-600" : "bg-gray-300 group-hover:bg-blue-300",
                                                    isCurrent && "ring-4 ring-blue-200"
                                                )}>
                                                    {isCompleted && <Check className="w-4 h-4 text-white m-auto pt-0.5"/>}
                                                </div>
                                                {index < faseOptions.length - 1 && (
                                                    <div className={cn("absolute top-1/2 left-1/2 w-full h-0.5 -translate-y-1/2", isCompleted ? "bg-blue-600" : "bg-gray-300")}></div>
                                                )}
                                            </div>
                                            <p className={cn("text-xs mt-2", isCurrent ? "font-bold text-blue-700" : "text-gray-500")}>{fase.nombre}</p>
                                        </div>
                                    </DropdownMenuTrigger>
                                    {!isTerminadoOEntregado && <DropdownMenuContent>
                                        <DropdownMenuItem onSelect={() => updateFaseYAvance(fase.nombre)}>Marcar como "{fase.nombre}"</DropdownMenuItem>
                                    </DropdownMenuContent>}
                                </DropdownMenu>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl border shadow-sm">
                <h2 className="text-xl font-bold mb-4">Bitácora de Avances</h2>
                {!isTerminadoOEntregado && (<div className="relative mb-4"><textarea value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Añadir un nuevo avance o comentario..." className="w-full border rounded-lg p-3 pr-28" rows="3" disabled={isTerminadoOEntregado}></textarea><div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1"><Button size="icon" variant="ghost" onClick={() => bitacoraFileInputRef.current?.click()} disabled={isTerminadoOEntregado}><ImageIcon className={`w-5 h-5 ${imagenBitacora ? 'text-blue-600' : ''}`}/></Button><input type="file" ref={bitacoraFileInputRef} className="hidden" accept="image/*" onChange={handleBitacoraImageSelect} /><Button size="icon" onClick={handleAddComentario} disabled={isSubmitting || isTerminadoOEntregado}>{isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5"/>}</Button></div></div>)}
                <div className="mt-4 space-y-4 max-h-96 overflow-y-auto pr-2">
                    {bitacora.length > 0 ? bitacora.map(b => (
                        <div key={b.id} className="flex gap-3 text-sm"><div className="w-8 h-8 bg-gray-200 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-gray-600 uppercase">{b.usuario?.nombre_completo?.charAt(0) || '?'}</div><div><p><span className="font-semibold">{b.usuario?.nombre_completo}</span> <span className="text-xs text-gray-500">{format(new Date(b.created_at), 'Pp', { locale: es })}</span></p>{b.comentario && <p className="text-gray-700">{b.comentario}</p>}{b.imagen_url && <a href={b.imagen_url} target="_blank" rel="noopener noreferrer"><img src={b.imagen_url} alt="Avance" className="mt-2 rounded-lg max-w-xs cursor-pointer"/></a>}</div></div>
                    )) : <div className="text-center py-6 text-gray-500">No hay entradas en la bitácora.</div>}
                </div>
            </div>
            
            <div className="bg-white p-6 rounded-xl border shadow-sm"><h2 className="text-xl font-bold mb-4">Pedidos de Materiales</h2><div className="text-center py-6 text-gray-500"><ShoppingCart className="mx-auto w-8 h-8 mb-2 text-gray-400" />No hay pedidos de materiales para este proyecto.</div></div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                <div className="bg-white p-6 rounded-xl border shadow-sm">
                    <h3 className="font-bold text-lg mb-3">Aprobación del Cliente</h3>
                    {aprobaciones.length > 0 ? (
                        <div className="space-y-3">
                            {aprobaciones.map(ap => (
                                <div key={ap.id} className="text-sm p-3 bg-green-50 rounded-lg"><p className="font-semibold text-green-800">Aprobado por {ap.usuario?.nombre_completo || 'Usuario'}</p><p className="text-xs text-gray-500">{format(new Date(ap.created_at), 'Pp', { locale: es })}</p>{ap.comentario && <p className="mt-1 text-gray-700">{ap.comentario}</p>}<a href={ap.url_documento} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs font-medium flex items-center gap-1 mt-1">Ver Documento <Download className="w-3 h-3"/></a></div>
                            ))}
                        </div>
                    ) : <div className="text-center py-6 text-gray-500"><Pencil className="mx-auto w-8 h-8 mb-2 text-gray-400" />Aún no hay registros de aprobación.</div>}
                    <Button size="sm" className="w-full gap-2 mt-4" onClick={() => setAddAprobacionDialogOpen(true)} disabled={isTerminadoOEntregado}><Pencil className="w-4 h-4"/> Registrar Aprobación</Button>
                </div>
                
                <div className="bg-white p-6 rounded-xl border shadow-sm">
                    <h3 className="font-bold text-lg mb-3">Archivos del Proyecto</h3>
                    {archivos.length > 0 ? (
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                            {archivos.map(file => (
                                <div key={file.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 group">
                                    <div className="flex items-center gap-3"><FileIcon className="w-5 h-5 text-blue-500" /><span className="text-sm font-medium text-gray-800">{file.nombre_archivo}</span></div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button asChild variant="ghost" size="icon" className="h-7 w-7"><a href={file.url_archivo} target="_blank" rel="noopener noreferrer"><Download className="w-4 h-4" /></a></Button>
                                        {!isTerminadoOEntregado && <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDeleteFile(file.id, file.url_archivo)}><Trash2 className="w-4 h-4" /></Button>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : <div className="text-center py-6 text-gray-500"><FileIcon className="mx-auto w-8 h-8 mb-2 text-gray-400" />No hay archivos adjuntos.</div>}
                    <Button variant="outline" className="w-full mt-4 gap-2" onClick={() => archivosProyectoInputRef.current?.click()} disabled={isUploading || isTerminadoOEntregado}>{isUploading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4"/>}{isUploading ? 'Subiendo...' : 'Adjuntar Archivo'}</Button>
                    <input type="file" ref={archivosProyectoInputRef} className="hidden" onChange={handleFileUpload} disabled={isTerminadoOEntregado}/>
                </div>
                
                <div className="bg-white p-6 rounded-xl border shadow-sm">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-2">
                        <h3 className="font-bold text-lg">Materiales</h3>
                        <MaterialStatusIndicator materiales={materiales.map(m => ({ ...m.material, cant: m.cantidad_requerida, stock: m.material.existencias }))} />
                    </div>
                     {materiales.length > 0 ? (
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                            {materiales.map(m => ( <div key={m.id} className="p-2 bg-gray-50 rounded-lg text-sm"><p className="font-medium">{m.material.descripcion}</p><p>Requerido: <span className="font-semibold">{m.cantidad_requerida} {m.material.unidad_venta}</span></p>{m.comentario && <p className="text-xs text-gray-500 italic">"{m.comentario}"</p>}</div> ))}
                        </div>
                     ) : <div className="text-center py-6 text-gray-500"><PackagePlus className="mx-auto w-8 h-8 mb-2 text-gray-400" />No hay materiales asignados.</div>}
                    <Button variant="outline" className="w-full mt-4 gap-2" onClick={() => setAddMaterialDialogOpen(true)} disabled={isTerminadoOEntregado}><PackagePlus className="w-4 h-4"/> Pedir Materiales</Button>
                </div>
          </motion.div>
        </div>
      </div>
      <AgregarMaterialDialog open={addMaterialDialogOpen} onOpenChange={setAddMaterialDialogOpen} onAddMaterial={handleAddMaterialToProject} disabled={isTerminadoOEntregado}/>
      {proyecto && <RegistrarAprobacionDialog open={addAprobacionDialogOpen} onOpenChange={setAddAprobacionDialogOpen} proyecto={proyecto} onSave={() => { fetchProyectoData(true); setAddAprobacionDialogOpen(false); }} disabled={isTerminadoOEntregado} />}
    </>
  );
};

export default ProyectoDetalle;