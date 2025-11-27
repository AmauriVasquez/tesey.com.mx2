import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2 } from 'lucide-react';

const ClienteDialog = ({ open, onOpenChange, cliente, onSave }) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    nombre: '',
    rfc: '',
    email: '',
    telefono: '',
    direccion: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (cliente) {
      setFormData({
          nombre: cliente.nombre || '',
          rfc: cliente.rfc || '',
          email: cliente.email || '',
          telefono: cliente.telefono || '',
          direccion: cliente.direccion || '',
      });
    } else {
      setFormData({
        nombre: '',
        rfc: '',
        email: '',
        telefono: '',
        direccion: ''
      });
    }
  }, [cliente, open]);
  
  const handleChange = (e) => {
      const { id, value } = e.target;
      setFormData(prev => ({...prev, [id]: value}));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    let error;
    if (cliente) { // Update
        const { error: updateError } = await supabase.from('clientes').update(formData).eq('id', cliente.id);
        error = updateError;
    } else { // Create
        const { error: insertError } = await supabase.from('clientes').insert(formData);
        error = insertError;
    }

    if (error) {
        toast({ variant: 'destructive', title: 'Error al guardar', description: error.message });
    } else {
        toast({
            title: cliente ? '✅ Cliente actualizado' : '✅ Cliente creado',
            description: 'Los cambios se han guardado correctamente',
        });
        onSave();
    }
    setIsSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {cliente ? 'Editar Cliente' : 'Nuevo Cliente'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="nombre">Nombre / Razón Social *</Label>
              <input
                id="nombre"
                type="text"
                value={formData.nombre}
                onChange={handleChange}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <Label htmlFor="rfc">RFC</Label>
              <input
                id="rfc"
                type="text"
                value={formData.rfc}
                onChange={(e) => setFormData({ ...formData, rfc: e.target.value.toUpperCase() })}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                maxLength={13}
              />
            </div>

            <div>
              <Label htmlFor="telefono">Teléfono</Label>
              <input
                id="telefono"
                type="tel"
                value={formData.telefono}
                onChange={handleChange}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="email">Email</Label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="direccion">Dirección</Label>
              <textarea
                id="direccion"
                value={formData.direccion}
                onChange={handleChange}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {cliente ? 'Actualizar' : 'Crear'} Cliente
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ClienteDialog;