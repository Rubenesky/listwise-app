import { NextResponse } from "next/server";

export async function GET() {
  const headers = "productName,category,attributes,sourceUrl\n";
  const example = `Camiseta de algodón orgánico,Ropa,"{""talla"":""M-L"",""color"":""Blanco"",""material"":""100% Algodón orgánico""}",\n`;
  const example2 = `Persiana veneciana aluminio,Hogar,"{""material"":""Aluminio""}",https://proveedor-ejemplo.com/ficha-persiana\n`;

  const csvContent = headers + example + example2;

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="plantilla_listwise.csv"',
    },
  });
}
