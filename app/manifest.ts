import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {name:'Prospecção Sign&Drive',short_name:'Sign&Drive',description:'Prospecção B2B da Thema Assinaturas',start_url:'/',display:'standalone',background_color:'#f5f7fa',theme_color:'#10253f',icons:[{src:'/icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}]};
}
