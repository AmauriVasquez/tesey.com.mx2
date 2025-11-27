import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/customSupabaseClient';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';

const CotizacionDialog = ({ open, onOpenChange, cotizacion, onSave }) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [nextFolio, setNextFolio] = useState('');

  const initialFormState = {
    cliente_id: null,
    cliente_nombre_externo: '',
    descripcion: '',
    fecha: new Date().toISOString().split('T')[0],
    estatus: 'Borrador',
    cotizacion_control: '',
    monto_subtotal: 0,
    aplica_iva: true,
    usuario_cotizacion: '',
  };

  const generateFolio = useCallback(async () => {
    const { data: lastQuote, error: fetchError } = await supabase
        .from('cotizaciones')
        .select('folio')
        .order('id', { ascending: false })
        .limit(1)
        .single();
    
    if (fetchError && fetchError.code !== 'PGRST116') {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo generar el folio.' });
        return 'Error';
    }
    
    const nextFolioNumber = lastQuote ? parseInt(lastQuote.folio.split('-')[2]) + 1 : 1;
    const currentYear = new Date().getFullYear();
    return `COT-${currentYear}-${String(nextFolioNumber).padStart(4, '0')}`;
  }, [toast]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [clientesRes, usuariosRes] = await Promise.all([
        supabase.from('clientes').select('id, nombre'),
        supabase.from('usuarios').select('id, nombre_completo')
    ]);

    if (clientesRes.error) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los clientes.' });
    } else {
        setClientes(clientesRes.data);
    }

    if (usuariosRes.error) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los usuarios.' });
    } else {
        setUsuarios(usuariosRes.data);
    }

    if (!cotizacion) {
        const folio = await generateFolio();
        setNextFolio(folio);
    }

    setLoading(false);
  }, [toast, cotizacion, generateFolio]);
  
  useEffect(() => {
    if(open) {
        fetchData();
        if (cotizacion) {
            const subtotal = cotizacion.total / 1.16;
            const tieneIva = Math.abs(cotizacion.total - subtotal * 1.16) < 0.01;
            
            setFormData({
                ...initialFormState,
                ...cotizacion,
                monto_subtotal: tieneIva ? subtotal : cotizacion.total,
                aplica_iva: tieneIva,
            });
        } else {
            setFormData({ ...initialFormState });
        }
    } else {
        setFormData(null);
        setNextFolio('');
    }
  }, [cotizacion, open, fetchData]);


  if (!formData) {
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    if (!formData.descripcion) {
      toast({ title: 'Error', description: 'La descripción es requerida.', variant: 'destructive' });
      setIsSaving(false);
      return;
    }
    
    const subtotal = parseFloat(formData.monto_subtotal) || 0;
    const iva = formData.aplica_iva ? subtotal * 0.16 : 0;
    const total = subtotal + iva;

    const quoteData = {
        cliente_id: formData.cliente_id,
        cliente_nombre_externo: formData.cliente_nombre_externo,
        descripcion: formData.descripcion,
        fecha: formData.fecha,
        total: total,
        estatus: formData.estatus,
        cotizacion_control: formData.cotizacion_control,
        usuario_cotizacion: formData.usuario_cotizacion,
    };

    if (cotizacion) { // Update
        const { error: quoteError } = await supabase
            .from('cotizaciones')
            .update(quoteData)
            .eq('id', cotizacion.id);

        if (quoteError) {
            toast({ variant: 'destructive', title: 'Error al actualizar', description: quoteError.message });
            setIsSaving(false);
            return;
        }

        toast({ title: '✅ Cotización actualizada' });

    } else { // Create
        quoteData.folio = nextFolio;

        const { error: quoteError } = await supabase
            .from('cotizaciones')
            .insert(quoteData);
        
        if (quoteError) {
            toast({ variant: 'destructive', title: 'Error al crear', description: quoteError.message });
            setIsSaving(false);
            return;
        }

        toast({ title: '✅ Cotización creada' });
    }

    onSave();
    setIsSaving(false);
  };

  const subtotal = parseFloat(formData.monto_subtotal) || 0;
  const iva = formData.aplica_iva ? subtotal * 0.16 : 0;
  const total = subtotal + iva;

  const usuariosOptions = usuarios.map(u => ({ value: u.nombre_completo, label: u.nombre_completo }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {cotizacion ? `Editar Cotización ${cotizacion.folio}` : 'Nueva Cotización'}
          </DialogTitle>
        </DialogHeader>

        {loading ? <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div> : (
        <>
        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto pr-2 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <Label htmlFor="folio">Folio de Cotización</Label>
                <Input id="folio" type="text" value={cotizacion ? cotizacion.folio : nextFolio} readOnly className="bg-gray-100" />
            </div>
            <div>
                <Label htmlFor="cotizacion_control">Cotización de Control</Label>
                <Input
                    id="cotizacion_control"
                    type="text"
                    value={formData.cotizacion_control || ''}
                    onChange={(e) => setFormData({ ...formData, cotizacion_control: e.target.value })}
                />
            </div>
            <div className="md:col-span-2">
                <Label htmlFor="usuario_cotizacion">Usuario</Label>
                <Combobox
                    options={usuariosOptions}
                    value={formData.usuario_cotizacion}
                    onChange={(value) => setFormData({ ...formData, usuario_cotizacion: value })}
                    placeholder="Seleccione o escriba un usuario..."
                    searchPlaceholder="Buscar usuario..."
                    notFoundMessage="No se encontró el usuario."
                />
            </div>
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
                <div>
                <Label htmlFor="cliente">Cliente</Label>
                <Select
                    value={formData.cliente_id ? `id:${formData.cliente_id}` : 'externo'}
                    onValueChange={(value) => {
                    if (value === 'externo') {
                        setFormData({ ...formData, cliente_id: null, cliente_nombre_externo: '' });
                    } else {
                        setFormData({ ...formData, cliente_id: parseInt(value.split(':')[1]), cliente_nombre_externo: '' });
                    }
                    }}
                >
                    <SelectTrigger id="cliente">
                    <SelectValue placeholder="Selecciona un cliente" />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="externo">-- Cliente Externo --</SelectItem>
                    {clientes.map(c => <SelectItem key={c.id} value={`id:${c.id}`}>{c.nombre}</SelectItem>)}
                    </SelectContent>
                </Select>
                </div>
                <div className="md:col-span-2">
                    {formData.cliente_id === null ? (
                        <div>
                            <Label htmlFor="cliente_nombre_externo">Nombre Cliente Externo</Label>
                            <Input
                            id="cliente_nombre_externo"
                            type="text"
                            value={formData.cliente_nombre_externo}
                            onChange={(e) => setFormData({ ...formData, cliente_nombre_externo: e.target.value })}
                            />
                        </div>
                    ) : null}
                </div>
            </div>
             <div className="md:col-span-2">
                <Label htmlFor="descripcion">Nombre / Descripción del Producto *</Label>
                <Input
                    id="descripcion"
                    type="text"
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    required
                />
            </div>
          </div>
          
          <div className="border-t pt-4 space-y-4">
              <div>
                <Label htmlFor="monto_subtotal">Monto (Subtotal)</Label>
                <Input
                  id="monto_subtotal"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.monto_subtotal}
                  onChange={(e) => setFormData({ ...formData, monto_subtotal: e.target.value })}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="aplica_iva"
                  checked={formData.aplica_iva}
                  onCheckedChange={(checked) => setFormData({ ...formData, aplica_iva: checked })}
                />
                <Label htmlFor="aplica_iva" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  ¿Aplica IVA? (16%)
                </Label>
              </div>
            </div>

        </form>

        <div className="border-t pt-4 mt-4 space-y-2">
          <div className="flex justify-between text-md">
            <span className="text-gray-600">Subtotal:</span>
            <span className="font-medium">{subtotal.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</span>
          </div>
          <div className="flex justify-between text-md">
            <span className="text-gray-600">IVA (16%):</span>
            <span className="font-medium">{iva.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</span>
          </div>
          <div className="flex justify-between text-xl font-bold">
            <span>Total:</span>
            <span>{total.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</span>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" onClick={handleSubmit} disabled={isSaving || (!cotizacion && !nextFolio)} className="bg-blue-600 hover:bg-blue-700">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {isSaving ? 'Guardando...' : cotizacion ? 'Actualizar Cotización' : 'Crear Cotización'}
            </Button>
          </div>
        </div>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CotizacionDialog;