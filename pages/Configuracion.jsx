import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { UserPlus, Trash2, Loader2, Edit, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useAuth } from '@/contexts/SupabaseAuthContext';

const roles = ['Administrador', 'Ventas', 'Proyectos', 'Operacion', 'Compras', 'Almacén', 'Consulta'];

const Configuracion = () => {
  const { toast } = useToast();
  const { user: currentUser, signUp } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userData, setUserData] = useState({ nombre_completo: '', email: '', rol: 'Ventas', password: '' });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('usuarios_con_email')
        .select('*')
        .order('nombre_completo');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los usuarios.' });
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleOpenDialog = (user = null) => {
    if (user) {
      setEditingUser(user);
      setUserData({ nombre_completo: user.nombre_completo, email: user.email, rol: user.rol, password: '' });
    } else {
      setEditingUser(null);
      setUserData({ nombre_completo: '', email: '', rol: 'Ventas', password: '' });
    }
    setIsDialogOpen(true);
  };

  const handleSaveUser = async () => {
    setIsSubmitting(true);
    if (editingUser) {
      const { error } = await supabase.from('usuarios')
        .update({ rol: userData.rol, nombre_completo: userData.nombre_completo })
        .eq('id', editingUser.id);
      
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
      } else {
        toast({ title: '✅ Usuario Actualizado' });
        await fetchUsers();
        setIsDialogOpen(false);
      }
    } else {
      if (!userData.email || !userData.password || !userData.nombre_completo) {
        toast({ variant: 'destructive', title: 'Error', description: 'Nombre, Email y Contraseña son requeridos.' });
        setIsSubmitting(false);
        return;
      }
      
      const { error } = await signUp(userData.email, userData.password, {
        data: {
          nombre_completo: userData.nombre_completo,
          rol: userData.rol,
        },
      });

      if (!error) {
        toast({ title: '✅ Usuario Creado', description: 'Se ha enviado un correo de confirmación.' });
        setTimeout(() => fetchUsers(), 1500); 
        setIsDialogOpen(false);
      }
    }
    setIsSubmitting(false);
  };

  const handleDeleteUser = async (userId) => {
    toast({
        variant: 'destructive',
        title: 'Operación no permitida',
        description: 'La eliminación de usuarios debe realizarse desde el panel de Supabase para mantener la integridad de la autenticación.',
    });
  };

  return (
    <>
      <Helmet>
        <title>Configuración - Sistema TESEY</title>
      </Helmet>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Configuración</h2>
          <p className="text-gray-600 mt-1">Administra los usuarios y los roles del sistema.</p>
        </div>

        <motion.div 
          className="bg-white p-6 rounded-xl border shadow-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">Gestión de Usuarios</h3>
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <UserPlus className="w-4 h-4" />
              Nuevo Usuario
            </Button>
          </div>

          <div className="overflow-x-auto">
            {loading ? <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin"/></div> : (
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium text-gray-500">Nombre</th>
                    <th className="text-left p-3 font-medium text-gray-500">Email</th>
                    <th className="text-left p-3 font-medium text-gray-500">Rol</th>
                    <th className="text-right p-3 font-medium text-gray-500">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, index) => (
                     <motion.tr 
                      key={user.id} 
                      className="border-b hover:bg-gray-50"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.05 }}
                     >
                      <td className="p-3 font-medium">{user.nombre_completo}</td>
                      <td className="p-3 text-gray-600">{user.email || 'Invitación pendiente'}</td>
                      <td className="p-3 text-gray-600">{user.rol}</td>
                      <td className="p-3 text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(user)} className="text-blue-500 hover:text-blue-700">
                           <Edit className="w-4 h-4"/>
                        </Button>
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" disabled={currentUser?.id === user.id}>
                                  <Trash2 className="w-4 h-4"/>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="text-red-500"/>¿Estás seguro de eliminar a {user.nombre_completo}?</AlertDialogTitle>
                                    <AlertDialogDescription>Esta acción no está permitida desde la aplicación por seguridad. Para eliminar un usuario, debes hacerlo desde el panel de control de Supabase en la sección de Autenticación.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Entendido</AlertDialogCancel>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                         </AlertDialog>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Editar Usuario' : 'Crear Nuevo Usuario'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="nombre" className="text-right">Nombre</Label>
              <Input id="nombre" value={userData.nombre_completo} onChange={(e) => setUserData({...userData, nombre_completo: e.target.value})} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">Email</Label>
              <Input id="email" type="email" value={userData.email} onChange={(e) => setUserData({...userData, email: e.target.value})} className="col-span-3" disabled={!!editingUser} />
            </div>
            {!editingUser && (
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="password" className="text-right">Contraseña</Label>
                    <Input id="password" type="password" value={userData.password} onChange={(e) => setUserData({...userData, password: e.target.value})} className="col-span-3" placeholder="Mínimo 6 caracteres" />
                </div>
            )}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="rol" className="text-right">Rol</Label>
              <Select value={userData.rol} onValueChange={(value) => setUserData({...userData, rol: value})}>
                <SelectTrigger className="col-span-3"><SelectValue placeholder="Seleccionar rol" /></SelectTrigger>
                <SelectContent>{roles.map(rol => <SelectItem key={rol} value={rol}>{rol}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancelar</Button></DialogClose>
            <Button onClick={handleSaveUser} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : null} {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Configuracion;