import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Users,
  HardHat,
  Package,
  FileText,
  AlertTriangle,
  Loader2,
  Filter,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import IncomeStats from '@/components/dashboard/IncomeStats';

const StatCard = ({ title, value, icon, to, colorClass }) => (
  <Link to={to}>
    <motion.div whileHover={{ y: -5 }} className="h-full">
      <Card className="h-full overflow-hidden transition-all duration-300 hover:shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {React.createElement(icon, { className: `h-5 w-5 ${colorClass}` })}
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">{value}</div>
        </CardContent>
      </Card>
    </motion.div>
  </Link>
);

const stockFilterOptions = [
    { value: 0, label: "Todo" },
    { value: 1, label: "Bajo Stock" },
    { value: 2, label: "Sobre Stock" },
];

const GeneralDashboard = () => {
    const [stats, setStats] = useState({ clientes: 0, cotizaciones: 0, proyectos: 0, materiales: 0 });
    const [lowStockMaterials, setLowStockMaterials] = useState([]);
    const [recentProjects, setRecentProjects] = useState([]);
    const [loadingStats, setLoadingStats] = useState(true);
    const [loadingMaterials, setLoadingMaterials] = useState(true);
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [stockFilter, setStockFilter] = useState(0); // Use numeric value directly
    const { toast } = useToast();

    const fetchData = useCallback(async () => {
        setLoadingStats(true);
        setLoadingProjects(true);

        try {
        const [
            { count: clientesCount },
            { count: cotizacionesCount },
            { count: proyectosCount },
            { count: materialesCount },
        ] = await Promise.all([
            supabase.from('clientes').select('*', { count: 'exact', head: true }),
            supabase.from('cotizaciones').select('*', { count: 'exact', head: true }),
            supabase.from('proyectos').select('*', { count: 'exact', head: true }),
            supabase.from('materiales').select('*', { count: 'exact', head: true }),
        ]);
        setStats({
            clientes: clientesCount || 0,
            cotizaciones: cotizacionesCount || 0,
            proyectos: proyectosCount || 0,
            materiales: materialesCount || 0,
        });
        setLoadingStats(false);

        const { data: projectsData, error: projectsError } = await supabase
            .from('proyectos')
            .select('id, folio, descripcion, estatus, avance, fecha_fin')
            .order('created_at', { ascending: false })
            .limit(5);

        if (projectsError) throw projectsError;
        setRecentProjects(projectsData);
        setLoadingProjects(false);

        } catch (error) {
        toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los datos del dashboard." });
        console.error(error);
        setLoadingStats(false);
        setLoadingProjects(false);
        }
    }, [toast]);
    
    const fetchStockMaterials = useCallback(async () => {
        setLoadingMaterials(true);
        try {
            let query = supabase
                .from('materiales')
                .select('id, descripcion, existencias, stock_min, stock_max, unidad_compra');
            
            if (stockFilter === 1) { // Bajo Stock
                query = query.lt('existencias', supabase.sql('stock_min'));
            } else if (stockFilter === 2) { // Sobre Stock
                query = query.gt('existencias', supabase.sql('stock_max'));
            }

            query = query.order('existencias', { ascending: true }).limit(5);

            const { data: materialsData, error: materialsError } = await query;
            if (materialsError) throw materialsError;
            setLowStockMaterials(materialsData);

        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los materiales." });
            console.error(error);
        } finally {
            setLoadingMaterials(false);
        }
    }, [toast, stockFilter]);

    useEffect(() => {
        fetchData();
        fetchStockMaterials();
        
        const handleFocus = () => {
            fetchData();
            fetchStockMaterials();
        };

        window.addEventListener('focus', handleFocus);
        return () => {
            window.removeEventListener('focus', handleFocus);
        };
    }, [fetchData, fetchStockMaterials]);

    const cardVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.1 } },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
    };
    
    return (
        <div className="space-y-6">
            {loadingStats ? (
                <div className="flex justify-center items-center h-24">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
            ) : (
                <motion.div
                    className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <motion.div variants={itemVariants}>
                        <StatCard title="Clientes" value={stats.clientes} icon={Users} to="/clientes" colorClass="text-blue-500" />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <StatCard title="Cotizaciones" value={stats.cotizaciones} icon={FileText} to="/cotizaciones" colorClass="text-green-500" />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <StatCard title="Proyectos Activos" value={stats.proyectos} icon={HardHat} to="/proyectos" colorClass="text-yellow-500" />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <StatCard title="Materiales" value={stats.materiales} icon={Package} to="/materiales" colorClass="text-red-500" />
                    </motion.div>
                </motion.div>
            )}

            <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
                    <Card>
                    <CardHeader>
                        <CardTitle>Proyectos Recientes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loadingProjects ? (
                        <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div>
                        ) : (
                        <Table>
                            <TableHeader>
                            <TableRow>
                                <TableHead>Folio</TableHead>
                                <TableHead>Descripción</TableHead>
                                <TableHead>Estatus</TableHead>
                                <TableHead className="w-[120px]">Avance</TableHead>
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                            {recentProjects.length > 0 ? recentProjects.map((p) => (
                                <TableRow key={p.id}>
                                <TableCell className="font-mono text-blue-600">
                                    <Link to={`/proyectos/${p.id}`} className="hover:underline">{p.folio}</Link>
                                </TableCell>
                                <TableCell className="font-medium truncate max-w-xs">{p.descripcion}</TableCell>
                                <TableCell>
                                    <Badge variant={p.estatus === 'Completado' ? 'success' : 'default'}>{p.estatus}</Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                    <Progress value={p.avance} className="h-2" />
                                    <span className="text-xs font-semibold">{p.avance}%</span>
                                    </div>
                                </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">No hay proyectos recientes.</TableCell>
                                </TableRow>
                            )}
                            </TableBody>
                        </Table>
                        )}
                    </CardContent>
                    </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
                    <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-orange-500" />
                            Inventario de Materiales
                        </CardTitle>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-2">
                                    <Filter className="h-4 w-4" />
                                    {stockFilterOptions.find(o => o.value === stockFilter)?.label || 'Filtrar'}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuRadioGroup value={stockFilter} onValueChange={(value) => setStockFilter(Number(value))}>
                                    {stockFilterOptions.map(option => (
                                        <DropdownMenuRadioItem key={option.value} value={String(option.value)}>
                                            {option.label}
                                        </DropdownMenuRadioItem>
                                    ))}
                                </DropdownMenuRadioGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </CardHeader>
                    <CardContent>
                        {loadingMaterials ? (
                        <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div>
                        ) : (
                            <Table>
                                <TableHeader>
                                <TableRow>
                                    <TableHead>Material</TableHead>
                                    <TableHead className="text-right">Existencias / Mínimo</TableHead>
                                </TableRow>
                                </TableHeader>
                                <TableBody>
                                {lowStockMaterials.length > 0 ? lowStockMaterials.map((m) => {
                                    const isLow = m.existencias < m.stock_min;
                                    const isOver = m.stock_max > 0 && m.existencias > m.stock_max;
                                    return (
                                        <TableRow key={m.id}>
                                            <TableCell className="font-medium">
                                                <Link to="/materiales" className="hover:underline">{m.descripcion}</Link>
                                            </TableCell>
                                            <TableCell className="text-right font-mono">
                                                <span className={cn({
                                                    'text-red-600 font-bold': isLow,
                                                    'text-yellow-600 font-bold': isOver,
                                                })}>
                                                    {m.existencias?.toFixed(2) || '0.00'}
                                                </span>
                                                <span className="text-gray-500"> / {m.stock_min?.toFixed(2) || '0.00'} {m.unidad_compra}</span>
                                            </TableCell>
                                        </TableRow>
                                    );
                                }) : (
                                    <TableRow>
                                        <TableCell colSpan={2} className="h-24 text-center">
                                            {stockFilter === 1 ? "No hay materiales con bajo stock." : stockFilter === 2 ? "No hay materiales con sobre stock." : "No hay materiales para mostrar."}
                                        </TableCell>
                                    </TableRow>
                                )}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
};


const Dashboard = () => {
  return (
    <>
      <Helmet>
        <title>Dashboard - Sistema TESEY</title>
        <meta name="description" content="Vista general del sistema de control de proyectos." />
      </Helmet>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Resumen de la actividad reciente y estado del sistema.</p>
        </div>
        
        <Tabs defaultValue="general" className="space-y-4">
            <TabsList>
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="income">Ingresos</TabsTrigger>
            </TabsList>
            <TabsContent value="general">
                <GeneralDashboard />
            </TabsContent>
            <TabsContent value="income">
                <IncomeStats />
            </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default Dashboard;